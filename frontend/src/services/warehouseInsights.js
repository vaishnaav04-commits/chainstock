
import { getReadContract, formatStatus } from "./blockchain";

export const STATUS_NAMES = [
  "Received",
  "Stored",
  "Picked",
  "InTransit",
  "Shipped",
  "Delivered",
  "Damaged",
  "Returned",
];

export const ZONE_ICONS = {
  Receiving: "📥",
  "Storage A": "📦",
  "Storage B": "📦",
  "Storage C": "📦",
  Packing: "🛠️",
  Dispatch: "🚚",
};

export const STATUS_COLORS = {
  Received: "#38bdf8",
  Stored: "#14b8a6",
  Picked: "#a78bfa",
  InTransit: "#f59e0b",
  Shipped: "#818cf8",
  Delivered: "#34d399",
  Damaged: "#fb7185",
  Returned: "#fb923c",
};

export const DEFAULT_SETTINGS = {
  stuckHours: 24,
  lowQuantity: 50,
};

// Read only: never creates a blockchain transaction.
export async function loadWarehouseSnapshot() {
  const contract = getReadContract();

  const [ids, zones, blockNumber] = await Promise.all([
    contract.getAllItemIds(),
    contract.getZones(),
    contract.runner.getBlockNumber(),
  ]);

  const block = await contract.runner.getBlock(blockNumber);

  // Use blockchain time, not the computer's clock.
  const asOf = Number(block.timestamp);

  const records = await Promise.all(
    ids.map(async (id) => {
      const [item, movements] = await Promise.all([
        contract.getItem(id),
        contract.getHistory(id),
      ]);

      const history = movements.map((movement, index) => ({
        index,
        zone: movement.toZone,
        status: formatStatus(movement.status),
        quantity: Number(movement.quantity),
        timestamp: Number(movement.timestamp),
        actor: movement.actor,
        note: movement.note,
      }));

      return {
        id: item.itemId,
        name: item.name,
        sku: item.sku,
        category: item.category,
        quantity: Number(item.quantity),
        unit: item.unit,
        zone: item.currentZone,
        status: formatStatus(item.status),
        createdAt: Number(item.createdAt),
        updatedAt: Number(item.updatedAt),
        history,
      };
    }),
  );

  return { items: records, zones, blockNumber, asOf };
}

// Dwell episodes: a recorded zone departure ends a
// completed dwell. The current zone has an open dwell.
export function getDwellEpisodes(snapshot) {
  const episodes = [];

  for (const item of snapshot.items) {
    const history = item.history;

    if (!history.length) continue;

    let zone = history[0].zone;
    let enteredAt = history[0].timestamp;

    for (let i = 1; i < history.length; i++) {
      const next = history[i];

      if (next.zone !== zone) {
        episodes.push({
          itemId: item.id,
          zone,
          startedAt: enteredAt,
          endedAt: next.timestamp,
          hours: Math.max(
            0,
            (next.timestamp - enteredAt) / 3600,
          ),
          completed: true,
        });

        zone = next.zone;
        enteredAt = next.timestamp;
      }
    }

    episodes.push({
      itemId: item.id,
      zone,
      startedAt: enteredAt,
      endedAt: snapshot.asOf,
      hours: Math.max(
        0,
        (snapshot.asOf - enteredAt) / 3600,
      ),
      completed: false,
    });
  }

  return episodes;
}

export function formatHours(hours) {
  if (!Number.isFinite(hours)) return "—";
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} d`;
}

export function getZoneStatistics(snapshot) {
  const episodes = getDwellEpisodes(snapshot);

  return snapshot.zones.map((name) => {
    const items = snapshot.items.filter(
      (item) => item.zone === name,
    );

    const finished = episodes.filter(
      (entry) => entry.zone === name && entry.completed,
    );

    const throughput = snapshot.items.reduce(
      (total, item) =>
        total +
        item.history.slice(1).filter(
          (entry) => entry.zone === name,
        ).length,
      0,
    );

    return {
      name,
      count: items.length,
      quantity: items.reduce(
        (sum, item) => sum + item.quantity,
        0,
      ),
      throughput,
      averageDwellHours: finished.length
        ? finished.reduce(
            (sum, entry) => sum + entry.hours,
            0,
          ) / finished.length
        : null,
      items,
    };
  });
}

export function getAnalytics(snapshot) {
  const movements = snapshot.items.flatMap(
    (item) =>
      item.history.slice(1).map((entry) => ({
        ...entry,
        itemId: item.id,
      })),
  );

  const dayCounts = new Map();

  movements.forEach((movement) => {
    const day = new Date(
      movement.timestamp * 1000,
    ).toISOString().slice(0, 10);

    dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
  });

  const movementsPerDay = [...dayCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day, count }));

  const distribution = STATUS_NAMES.map((name) => ({
    name,
    value: snapshot.items.filter(
      (item) => item.status === name,
    ).length,
  })).filter((row) => row.value > 0);

  const actorCounts = new Map();

  for (const movement of movements) {
    const key = movement.actor.toLowerCase();
    actorCounts.set(key, (actorCounts.get(key) || 0) + 1);
  }

  const operators = [...actorCounts.entries()]
    .map(([address, count]) => ({
      address,
      name: `${address.slice(0, 6)}…${address.slice(-4)}`,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const exceptional = snapshot.items.filter((item) =>
    item.history.some((movement) =>
      movement.status === "Damaged" ||
      movement.status === "Returned",
    ),
  ).length;

  const rate = snapshot.items.length
    ? (exceptional / snapshot.items.length) * 100
    : 0;

  return {
    movements,
    movementsPerDay,
    distribution,
    operators,
    zoneStats: getZoneStatistics(snapshot),
    exceptional,
    exceptionRate: rate,
  };
}

export function generateAlerts(snapshot, settings) {
  const alerts = [];
  const episodes = getDwellEpisodes(snapshot);
  const stuckHours = Number(settings.stuckHours);
  const lowQuantity = Number(settings.lowQuantity);

  // Current damaged goods.
  for (const item of snapshot.items) {
    if (item.status === "Damaged") {
      alerts.push({
        id: `damage-${item.id}`,
        type: "Damaged",
        severity: "critical",
        itemId: item.id,
        title: `${item.id} is marked Damaged`,
        description:
          `${item.name} requires inspection or exception handling.`,
      });
    }
  }

  // Only the current open dwell can represent an item stuck now.
  for (const episode of episodes.filter(
    (entry) => !entry.completed,
  )) {
    if (episode.hours >= stuckHours) {
      alerts.push({
        id: `stuck-${episode.itemId}`,
        type: "Stagnant",
        severity: "warning",
        itemId: episode.itemId,
        title: `${episode.itemId} may be stuck`,
        description:
          `${formatHours(episode.hours)} in ${episode.zone}, ` +
          `above the ${stuckHours}-hour threshold.`,
      });
    }
  }

  // A proxy based on registered tracked quantities,
  // not a stock accounting or reorder-point system.
  const active = snapshot.items.filter(
    (item) =>
      !["Shipped", "Delivered"].includes(item.status),
  );

  const grouped = new Map();

  for (const item of active) {
    grouped.set(
      item.category,
      (grouped.get(item.category) || 0) + item.quantity,
    );
  }

  for (const [category, quantity] of grouped.entries()) {
    if (quantity < lowQuantity) {
      alerts.push({
        id: `low-${category}`,
        type: "Low tracked quantity",
        severity: "info",
        itemId: null,
        title: `${category}: ${quantity} tracked units`,
        description:
          `Below your ${lowQuantity}-unit threshold. ` +
          "Check units and actual warehouse stock separately.",
      });
    }
  }

  const priority = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  return alerts.sort(
    (a, b) =>
      priority[a.severity] - priority[b.severity],
  );
}

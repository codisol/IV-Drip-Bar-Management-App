import { InventoryItem } from '../types';

export interface BatchAllocation {
  inventoryItemId: string;
  batchNumber: string;
  genericName: string;
  brandName: string;
  quantity: number;
  expiryDate: string;
}

export interface DrugGroup {
  genericName: string;
  brandName: string;
  strength: string;
  totalQuantity: number;
  reorderLevel: number;
  batches: Array<{
    id: string;
    batchNumber: string;
    quantity: number;
    expiryDate: string;
    dateReceived: string;
  }>;
}

/**
 * Groups inventory items by drug (generic name + brand name + strength)
 * Shows total quantity across all batches with batch breakdown
 */
export function groupInventoryByDrug(inventory: InventoryItem[]): DrugGroup[] {
  const grouped = new Map<string, DrugGroup>();

  inventory.forEach(item => {
    const key = `${item.genericName}|${item.brandName}|${item.strength}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        genericName: item.genericName,
        brandName: item.brandName,
        strength: item.strength,
        totalQuantity: 0,
        reorderLevel: item.reorderLevel || 10,
        batches: []
      });
    }

    const group = grouped.get(key)!;
    group.totalQuantity += item.quantity;
    group.batches.push({
      id: item.id,
      batchNumber: item.batchNumber,
      quantity: item.quantity,
      expiryDate: item.expiryDate || item.expirationDate || '',
      dateReceived: item.dateReceived
    });
  });

  // Sort batches within each group by expiry date (FEFO)
  grouped.forEach(group => {
    group.batches.sort((a, b) => {
      const dateA = new Date(a.expiryDate || '9999-12-31');
      const dateB = new Date(b.expiryDate || '9999-12-31');
      return dateA.getTime() - dateB.getTime();
    });
  });

  return Array.from(grouped.values());
}

/**
 * Allocates requested quantity across batches using FEFO (First Expiry First Out)
 * Returns array of batch allocations or null if insufficient stock
 */
export function allocateBatchesFEFO(
  inventory: InventoryItem[],
  genericName: string,
  brandName: string,
  strength: string,
  requestedQuantity: number
): BatchAllocation[] | null {
  // Find all batches for this drug
  const availableBatches = inventory
    .filter(item =>
      item.genericName === genericName &&
      item.brandName === brandName &&
      item.strength === strength &&
      item.quantity > 0
    )
    .sort((a, b) => {
      // Sort by expiry date (FEFO)
      const dateA = new Date(a.expiryDate || a.expirationDate || '9999-12-31');
      const dateB = new Date(b.expiryDate || b.expirationDate || '9999-12-31');
      return dateA.getTime() - dateB.getTime();
    });

  // Check if we have enough total stock
  const totalAvailable = availableBatches.reduce((sum, batch) => sum + batch.quantity, 0);
  if (totalAvailable < requestedQuantity) {
    return null;
  }

  // Allocate from batches with earliest expiry first
  const allocations: BatchAllocation[] = [];
  let remainingQuantity = requestedQuantity;

  for (const batch of availableBatches) {
    if (remainingQuantity <= 0) break;

    const quantityFromThisBatch = Math.min(batch.quantity, remainingQuantity);

    allocations.push({
      inventoryItemId: batch.id,
      batchNumber: batch.batchNumber,
      genericName: batch.genericName,
      brandName: batch.brandName,
      quantity: quantityFromThisBatch,
      expiryDate: batch.expiryDate || batch.expirationDate || ''
    });

    remainingQuantity -= quantityFromThisBatch;
  }

  return allocations;
}

/**
 * Allocates from a specific batch
 */
export function allocateSpecificBatch(
  inventory: InventoryItem[],
  inventoryItemId: string,
  requestedQuantity: number
): BatchAllocation | null {
  const batch = inventory.find(item => item.id === inventoryItemId);

  if (!batch || batch.quantity < requestedQuantity) {
    return null;
  }

  return {
    inventoryItemId: batch.id,
    batchNumber: batch.batchNumber,
    genericName: batch.genericName,
    brandName: batch.brandName,
    quantity: requestedQuantity,
    expiryDate: batch.expiryDate || batch.expirationDate || ''
  };
}

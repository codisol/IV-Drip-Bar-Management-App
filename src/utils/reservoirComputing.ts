/**
 * Reservoir Computing Model for Inventory Demand Forecasting
 * Implements Echo State Network (ESN) with Markov Chain state transitions
 * Designed for low-transaction environments (new clinics)
 */

import { InventoryItem, InventoryTransaction } from '../types';

export interface ReservoirState {
  weights: number[][];
  readoutWeights: number[];
  state: number[];
  lastError: number;
  trainingSamples: number;
}

export interface MarkovState {
  current: 'low_activity' | 'normal_activity' | 'high_activity';
  transitionCounts: {
    [key: string]: { [key: string]: number };
  };
  consecutiveDays: number;
}

export interface ForecastConfig {
  reservoirSize: number;
  spectralRadius: number;
  inputScaling: number;
  leakingRate: number;
  safetyStockMultiplier: number;
  forecastHorizon: number; // days
  retrainThreshold: number; // RMSE threshold
}

export interface HistoricalDataPoint {
  date: string;
  drugId: string;
  genericName: string;
  stockOutVolume: number;
  expiryDate?: string;
  remainingShelfLife: number; // days
}

export interface ForecastResult {
  drugId: string;
  genericName: string;
  currentStock: number;
  predictions: Array<{
    date: string;
    predictedDemand: number;
    confidenceLower: number;
    confidenceUpper: number;
    stockLevel: number;
  }>;
  safetyStock: number;
  reorderPoint: number;
  expiryWarnings: Array<{
    batchNumber: string;
    expiryDate: string;
    quantity: number;
    daysUntilExpiry: number;
  }>;
  nextRestockDate: string | null;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  modelConfidence: number;
  markovState: string;
}

const DEFAULT_CONFIG: ForecastConfig = {
  reservoirSize: 50, // Smaller for low-data scenarios
  spectralRadius: 0.95,
  inputScaling: 0.3,
  leakingRate: 0.3,
  safetyStockMultiplier: 1.5,
  forecastHorizon: 30,
  retrainThreshold: 0.5
};

/**
 * Initialize reservoir with random weights
 */
export function initializeReservoir(
  config: ForecastConfig = DEFAULT_CONFIG
): { weights: number[][], state: number[] } {
  const { reservoirSize, spectralRadius } = config;

  // Random sparse reservoir weights
  const weights: number[][] = Array(reservoirSize)
    .fill(0)
    .map(() =>
      Array(reservoirSize)
        .fill(0)
        .map(() => (Math.random() < 0.1 ? (Math.random() - 0.5) * 2 : 0))
    );

  // Normalize to desired spectral radius
  const normalized = normalizeSpectralRadius(weights, spectralRadius);

  return {
    weights: normalized,
    state: Array(reservoirSize).fill(0)
  };
}

/**
 * Normalize reservoir weights to target spectral radius
 */
function normalizeSpectralRadius(weights: number[][], targetRadius: number): number[][] {
  // Simplified: use max absolute row sum as approximation
  const maxSum = Math.max(...weights.map(row =>
    row.reduce((sum, val) => sum + Math.abs(val), 0)
  ));

  if (maxSum === 0) return weights;

  const scale = targetRadius / maxSum;
  return weights.map(row => row.map(val => val * scale));
}

/**
 * Update reservoir state with new input
 */
export function updateReservoirState(
  currentState: number[],
  input: number[],
  weights: number[][],
  config: ForecastConfig = DEFAULT_CONFIG
): number[] {
  const { leakingRate, inputScaling, reservoirSize } = config;

  const newState = Array(reservoirSize).fill(0);

  for (let i = 0; i < reservoirSize; i++) {
    let activation = 0;

    // Input contribution
    for (let j = 0; j < input.length; j++) {
      activation += input[j] * inputScaling * (Math.random() - 0.5) * 2;
    }

    // Reservoir recurrent connections
    for (let j = 0; j < reservoirSize; j++) {
      activation += weights[i][j] * currentState[j];
    }

    // Leaky integrator neuron with tanh activation
    newState[i] = (1 - leakingRate) * currentState[i] +
      leakingRate * Math.tanh(activation);
  }

  return newState;
}

/**
 * Train readout weights using ridge regression
 */
export function trainReadout(
  stateHistory: number[][],
  targetHistory: number[],
  regularization: number = 0.01
): number[] {
  if (stateHistory.length === 0 || stateHistory.length !== targetHistory.length) {
    return Array(stateHistory[0]?.length || 50).fill(0);
  }

  const n = stateHistory.length;
  const m = stateHistory[0].length;

  // Simplified ridge regression (for production, use proper linear algebra library)
  // W = (X^T X + λI)^-1 X^T y

  const weights = Array(m).fill(0);

  for (let i = 0; i < m; i++) {
    let numerator = 0;
    let denominator = regularization;

    for (let j = 0; j < n; j++) {
      numerator += stateHistory[j][i] * targetHistory[j];
      denominator += stateHistory[j][i] * stateHistory[j][i];
    }

    weights[i] = numerator / denominator;
  }

  return weights;
}

/**
 * Predict output from reservoir state
 */
export function predictFromState(
  state: number[],
  readoutWeights: number[]
): number {
  let output = 0;
  for (let i = 0; i < state.length && i < readoutWeights.length; i++) {
    output += state[i] * readoutWeights[i];
  }
  return Math.max(0, output); // Demand cannot be negative
}

/**
 * Prepare historical data from transactions
 */
/**
 * Prepare historical data from transactions
 * Aggregates data across ALL batches of the same drug (Generic + Brand + Strength)
 */
export function prepareHistoricalData(
  transactions: InventoryTransaction[],
  inventory: InventoryItem[],
  genericName: string,
  brandName: string,
  strength: string
): HistoricalDataPoint[] {
  // Find all batches that match this drug profile
  const matchingBatches = inventory.filter(i =>
    i.genericName === genericName &&
    i.brandName === brandName &&
    i.strength === strength
  );

  const matchingBatchIds = new Set(matchingBatches.map(b => b.id));

  if (matchingBatches.length === 0) return [];

  // Group transactions by date, summing up quantity across all matching batches
  const dailyData: { [date: string]: number } = {};

  transactions
    .filter(t => matchingBatchIds.has(t.inventoryItemId) && t.type === 'OUT')
    .forEach(t => {
      const dateKey = t.date.split('T')[0];
      dailyData[dateKey] = (dailyData[dateKey] || 0) + t.quantity;
    });

  // Use the batch with the latest expiry as the reference for shelf life
  // (Optimistic approach: we assume we can use the freshest stock)
  const bestExpiryDate = matchingBatches.reduce((latest, batch) => {
    const batchDate = new Date(batch.expiryDate || batch.expirationDate || '');
    const latestDate = new Date(latest);
    return batchDate > latestDate ? (batch.expiryDate || batch.expirationDate || '') : latest;
  }, '');

  const expiryDateObj = new Date(bestExpiryDate);

  return Object.entries(dailyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, volume]) => {
      const dataDate = new Date(date);
      const remainingShelfLife = bestExpiryDate ? Math.floor(
        (expiryDateObj.getTime() - dataDate.getTime()) / (1000 * 60 * 60 * 24)
      ) : 365; // Default to 1 year if no expiry

      return {
        date,
        drugId: matchingBatches[0].id, // Use representative ID
        genericName: genericName,
        stockOutVolume: volume,
        expiryDate: bestExpiryDate,
        remainingShelfLife: Math.max(0, remainingShelfLife)
      };
    });
}

/**
 * Normalize time series data
 */
export function normalizeTimeSeries(data: number[]): {
  normalized: number[],
  mean: number,
  std: number
} {
  const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
  const std = Math.sqrt(variance) || 1;

  const normalized = data.map(val => (val - mean) / std);

  return { normalized, mean, std };
}

/**
 * Denormalize predictions
 */
export function denormalize(normalized: number, mean: number, std: number): number {
  return normalized * std + mean;
}

/**
 * Detect Markov state based on recent transaction patterns
 */
export function detectMarkovState(
  historicalData: HistoricalDataPoint[],
  previousState?: MarkovState
): MarkovState {
  const recentDays = 7;
  const recent = historicalData.slice(-recentDays);

  if (recent.length === 0) {
    return {
      current: 'low_activity',
      transitionCounts: previousState?.transitionCounts || {},
      consecutiveDays: 0
    };
  }

  const avgDemand = recent.reduce((sum, d) => sum + d.stockOutVolume, 0) / recent.length;

  // Classify activity level
  let currentState: 'low_activity' | 'normal_activity' | 'high_activity';
  if (avgDemand < 3) {
    currentState = 'low_activity';
  } else if (avgDemand < 8) {
    currentState = 'normal_activity';
  } else {
    currentState = 'high_activity';
  }

  // Update transition counts for Markov chain
  // Use a flat map for transition counts in this detection function.
  const transitionCounts: Record<string, number> = previousState && (previousState as any).transitionCounts
    ? { ...(previousState as any).transitionCounts }
    : {};
  if (previousState) {
    const key = `${previousState.current}_to_${currentState}`;
    transitionCounts[key] = (transitionCounts[key] || 0) + 1;
  }

  const consecutiveDays =
    previousState?.current === currentState
      ? (previousState.consecutiveDays || 0) + 1
      : 1;

  return {
    current: currentState,
    transitionCounts: transitionCounts as any,
    consecutiveDays
  };
}

/**
 * Calculate Root Mean Squared Error
 */
export function calculateRMSE(predictions: number[], actuals: number[]): number {
  if (predictions.length !== actuals.length || predictions.length === 0) {
    return 0;
  }

  const sumSquaredError = predictions.reduce(
    (sum, pred, i) => sum + Math.pow(pred - actuals[i], 2),
    0
  );

  return Math.sqrt(sumSquaredError / predictions.length);
}

/**
 * Calculate safety stock using RC-based variability estimation
 */
export function calculateSafetyStock(
  predictions: number[],
  leadTimeDays: number = 7,
  serviceLevel: number = 0.95,
  config: ForecastConfig = DEFAULT_CONFIG
): number {
  if (predictions.length === 0) return 0;

  // Calculate demand variability
  const mean = predictions.reduce((sum, p) => sum + p, 0) / predictions.length;
  const variance = predictions.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / predictions.length;
  const stdDev = Math.sqrt(variance);

  // Z-score for service level (simplified)
  const zScore = serviceLevel >= 0.95 ? 1.65 : 1.28;

  // Safety stock = Z * σ * sqrt(lead time) * multiplier
  const safetyStock = zScore * stdDev * Math.sqrt(leadTimeDays) * config.safetyStockMultiplier;

  return Math.ceil(safetyStock);
}

/**
 * Generate forecast with expiry awareness
 */
export function generateForecast(
  genericName: string,
  brandName: string,
  strength: string,
  inventory: InventoryItem[],
  transactions: InventoryTransaction[],
  config: ForecastConfig = DEFAULT_CONFIG,
  storedModel?: {
    weights: number[][];
    readoutWeights: number[];
    mean: number;
    std: number;
  }
): ForecastResult | null {
  // Find all batches for this drug
  const matchingBatches = inventory.filter(i =>
    i.genericName === genericName &&
    i.brandName === brandName &&
    i.strength === strength
  );

  if (matchingBatches.length === 0) return null;

  const representativeBatch = matchingBatches[0];
  const totalStock = matchingBatches.reduce((sum, b) => sum + b.quantity, 0);

  // Prepare historical data aggregating ALL batches
  const historicalData = prepareHistoricalData(transactions, inventory, genericName, brandName, strength);

  if (historicalData.length < 3) {
    // Not enough data for RC - use simple heuristic
    return createFallbackForecast(representativeBatch, totalStock, historicalData, config);
  }

  // Detect Markov state
  const markovState = detectMarkovState(historicalData);

  // Normalize time series
  const demands = historicalData.map(d => d.stockOutVolume);
  const { normalized, mean, std } = normalizeTimeSeries(demands);

  // Initialize or use stored reservoir
  const reservoir = storedModel || initializeReservoir(config);
  let state = Array(config.reservoirSize).fill(0);
  const stateHistory: number[][] = [];
  const targetHistory: number[] = [];

  // Collect state-target pairs for training
  for (let i = 0; i < normalized.length - 1; i++) {
    const input = [normalized[i], i / normalized.length]; // input + time feature
    state = updateReservoirState(state, input, reservoir.weights, config);
    stateHistory.push([...state]);
    targetHistory.push(normalized[i + 1]);
  }

  // Train readout weights
  const readoutWeights = trainReadout(stateHistory, targetHistory);

  // Generate predictions
  const predictions: ForecastResult['predictions'] = [];
  let currentStock = totalStock;
  const today = new Date();

  for (let day = 0; day < config.forecastHorizon; day++) {
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + day);

    // Predict normalized demand
    const normalizedPred = predictFromState(state, readoutWeights);
    const predictedDemand = Math.max(0, denormalize(normalizedPred, mean, std));

    // Update stock level
    currentStock = Math.max(0, currentStock - predictedDemand);

    // Calculate confidence intervals (±20% based on historical variance)
    const confidence = std * 0.2;

    predictions.push({
      date: futureDate.toISOString().split('T')[0],
      predictedDemand: Math.round(predictedDemand * 10) / 10,
      confidenceLower: Math.max(0, predictedDemand - confidence),
      confidenceUpper: predictedDemand + confidence,
      stockLevel: Math.round(currentStock * 10) / 10
    });

    // Update reservoir state for next prediction
    const nextInput = [normalizedPred, (normalized.length + day) / (normalized.length + config.forecastHorizon)];
    state = updateReservoirState(state, nextInput, reservoir.weights, config);
  }

  // Calculate safety stock
  const safetyStock = calculateSafetyStock(
    predictions.map(p => p.predictedDemand),
    7,
    0.95,
    config
  );

  // Reorder point = (average daily demand * lead time) + safety stock
  const avgDailyDemand = predictions.slice(0, 7).reduce((sum, p) => sum + p.predictedDemand, 0) / 7;
  const reorderPoint = Math.ceil(avgDailyDemand * 7 + safetyStock);

  // Check expiry warnings
  const expiryWarnings = checkExpiryWarnings(inventory, genericName, brandName, strength);

  // Determine next restock date
  const nextRestockDate = predictions.find(p => p.stockLevel <= reorderPoint)?.date || null;

  // Calculate risk level
  const riskLevel = calculateRiskLevel(
    currentStock,
    reorderPoint,
    predictions,
    expiryWarnings
  );

  // Model confidence based on data availability
  const modelConfidence = Math.min(100, (historicalData.length / 30) * 100);

  return {
    drugId: representativeBatch.id,
    genericName: representativeBatch.genericName,
    currentStock: totalStock,
    predictions,
    safetyStock,
    reorderPoint,
    expiryWarnings,
    nextRestockDate,
    riskLevel,
    modelConfidence,
    markovState: markovState.current
  };
}

/**
 * Create fallback forecast for low-data scenarios
 */
function createFallbackForecast(
  item: InventoryItem,
  totalStock: number,
  historicalData: HistoricalDataPoint[],
  config: ForecastConfig
): ForecastResult {
  const avgDemand = historicalData.length > 0
    ? historicalData.reduce((sum, d) => sum + d.stockOutVolume, 0) / historicalData.length
    : 1; // Assume minimal demand for new items

  const predictions: ForecastResult['predictions'] = [];
  let stock = totalStock;
  const today = new Date();

  for (let day = 0; day < config.forecastHorizon; day++) {
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + day);

    stock = Math.max(0, stock - avgDemand);

    predictions.push({
      date: futureDate.toISOString().split('T')[0],
      predictedDemand: avgDemand,
      confidenceLower: avgDemand * 0.5,
      confidenceUpper: avgDemand * 1.5,
      stockLevel: stock
    });
  }

  const safetyStock = Math.ceil(avgDemand * 7 * 1.5);
  const reorderPoint = Math.ceil(avgDemand * 7 + safetyStock);
  const expiryWarnings = checkExpiryWarnings(
    [item],
    item.genericName,
    item.brandName,
    item.strength
  );
  const nextRestockDate = predictions.find(p => p.stockLevel <= reorderPoint)?.date || null;

  return {
    drugId: item.id,
    genericName: item.genericName,
    currentStock: totalStock,
    predictions,
    safetyStock,
    reorderPoint,
    expiryWarnings,
    nextRestockDate,
    riskLevel: calculateRiskLevel(totalStock, reorderPoint, predictions, expiryWarnings),
    modelConfidence: 30, // Low confidence due to limited data
    markovState: 'low_activity'
  };
}

/**
 * Check for expiry warnings
 */
function checkExpiryWarnings(
  inventory: InventoryItem[],
  genericName: string,
  brandName: string,
  strength: string
): Array<{ batchNumber: string; expiryDate: string; quantity: number; daysUntilExpiry: number }> {
  const today = new Date();
  const warnings: Array<{ batchNumber: string; expiryDate: string; quantity: number; daysUntilExpiry: number }> = [];

  inventory
    .filter(i =>
      i.genericName === genericName &&
      i.brandName === brandName &&
      i.strength === strength
    )
    .forEach(item => {
      const expiryDate = new Date(item.expiryDate || item.expirationDate || '');
      const daysUntilExpiry = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry < 90 && daysUntilExpiry > 0) {
        warnings.push({
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate || item.expirationDate || '',
          quantity: item.quantity,
          daysUntilExpiry
        });
      }
    });

  return warnings.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}

/**
 * Calculate risk level
 */
function calculateRiskLevel(
  currentStock: number,
  reorderPoint: number,
  predictions: ForecastResult['predictions'],
  expiryWarnings: ForecastResult['expiryWarnings']
): 'critical' | 'high' | 'medium' | 'low' {
  // Critical: stock below reorder point OR expiring within 30 days
  if (currentStock < reorderPoint || expiryWarnings.some(w => w.daysUntilExpiry < 30)) {
    return 'critical';
  }

  // High: will reach reorder point within 7 days
  const willDepleteSoon = predictions.slice(0, 7).some(p => p.stockLevel <= reorderPoint);
  if (willDepleteSoon || expiryWarnings.some(w => w.daysUntilExpiry < 60)) {
    return 'high';
  }

  // Medium: will reach reorder point within 14 days
  const willDepleteModerate = predictions.slice(0, 14).some(p => p.stockLevel <= reorderPoint);
  if (willDepleteModerate) {
    return 'medium';
  }

  return 'low';
}

/**
 * Check if model needs retraining based on error spike
 */
export function shouldRetrain(
  predictions: number[],
  actuals: number[],
  previousError: number,
  threshold: number = DEFAULT_CONFIG.retrainThreshold
): boolean {
  const currentError = calculateRMSE(predictions, actuals);
  const errorIncrease = currentError - previousError;

  return errorIncrease > threshold;
}

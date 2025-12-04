import { useMemo, useState } from 'react';
import { InventoryItem, InventoryTransaction } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { AlertTriangle, RefreshCw, Calendar, Package, TrendingDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Area, AreaChart } from 'recharts';
import { Alert, AlertDescription } from './ui/alert';
import { Progress } from './ui/progress';
import { generateForecast, ForecastResult } from '../utils/reservoirComputing';
import { formatDate } from '../utils/dateFormatter';
import { toast } from 'sonner';

interface InventoryForecastProps {
  inventory: InventoryItem[];
  transactions: InventoryTransaction[];
}

export function InventoryForecast({ inventory, transactions }: InventoryForecastProps) {
  const [isRetraining, setIsRetraining] = useState(false);
  const [lastTrainingTime, setLastTrainingTime] = useState<Date>(new Date());

  // Generate forecasts grouped by drug (generic + brand + strength), combining all batches
  const allForecasts: Array<ForecastResult & { mostCriticalBatch: InventoryItem }> = useMemo(() => {
    const forecasts: Array<ForecastResult & { mostCriticalBatch: InventoryItem }> = [];

    // Group inventory by unique drug profile (Generic + Brand + Strength)
    const drugGroups = new Map<string, InventoryItem[]>();
    inventory.forEach(item => {
      const key = `${item.genericName}|${item.brandName}|${item.strength}`;
      if (!drugGroups.has(key)) {
        drugGroups.set(key, [item]);
      } else {
        drugGroups.get(key)!.push(item);
      }
    });

    // Generate forecast for each drug group
    drugGroups.forEach((batches) => {
      // Use the first batch as representative for static details
      const representativeBatch = batches[0];

      const forecast = generateForecast(
        representativeBatch.genericName,
        representativeBatch.brandName,
        representativeBatch.strength,
        inventory,
        transactions
      );

      if (forecast) {
        // Find the most critical batch (lowest expiry date)
        const sortedByExpiry = [...batches].sort((a, b) => {
          if (!a.expiryDate) return 1;
          if (!b.expiryDate) return -1;
          return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
        });

        const mostCriticalBatch = sortedByExpiry[0];

        forecasts.push({
          ...forecast,
          mostCriticalBatch
        });
      }
    });

    return forecasts;
  }, [inventory, transactions, lastTrainingTime]);

  // Calculate risk score for each drug
  const calculateRiskScore = (forecast: ForecastResult & { mostCriticalBatch: InventoryItem }): number => {
    let score = 0;

    // Risk from stock level (0-40 points)
    const riskOrder = { critical: 40, high: 30, medium: 20, low: 10 };
    score += riskOrder[forecast.riskLevel];

    // Risk from near expiration (0-30 points) - check the most critical batch
    if (forecast.mostCriticalBatch.expiryDate) {
      const daysUntilExpiry = Math.floor((new Date(forecast.mostCriticalBatch.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry <= 30) {
        score += 30;
      } else if (daysUntilExpiry <= 60) {
        score += 20;
      } else if (daysUntilExpiry <= 90) {
        score += 10;
      }
    }

    // Risk from high turnover - check if stock will run out soon (0-30 points)
    if (forecast.nextRestockDate) {
      const daysUntilRestock = Math.floor((new Date(forecast.nextRestockDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysUntilRestock <= 7) {
        score += 30;
      } else if (daysUntilRestock <= 14) {
        score += 20;
      } else if (daysUntilRestock <= 21) {
        score += 10;
      }
    }

    return score;
  };

  // Get top 6 at-risk drugs
  const atRiskDrugs = useMemo(() => {
    const drugsWithRisk = allForecasts.map(forecast => ({
      forecast,
      riskScore: calculateRiskScore(forecast)
    })).filter(d => d.riskScore > 0); // Only include drugs with some risk

    // Sort by risk score (highest first) and take top 6
    return drugsWithRisk
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 6);
  }, [allForecasts]);

  // Manual retrain function
  const handleRetrain = () => {
    setIsRetraining(true);
    toast.info('Updating predictions...');

    setTimeout(() => {
      setLastTrainingTime(new Date());
      setIsRetraining(false);
      toast.success('Predictions updated successfully');
    }, 1500);
  };

  // Get critical items
  const criticalItems = allForecasts.filter(f => f.riskLevel === 'critical' || f.riskLevel === 'high');

  // Calculate overall metrics
  const avgModelConfidence = allForecasts.length > 0
    ? allForecasts.reduce((sum, f) => sum + f.modelConfidence, 0) / allForecasts.length
    : 0;

  // Calculate when error margin will improve
  const getDaysUntilBetterAccuracy = (confidence: number) => {
    if (confidence >= 80) return null;
    if (confidence >= 50) return 7;
    return 14;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Summary Card */}
      <Card className="bg-gradient-to-r from-primary/5 to-secondary/20 border-primary/30">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1">
              <h3 className="font-medium mb-1">Inventory Forecast Status</h3>
              <p className="text-sm text-muted-foreground">
                Monitoring {allForecasts.length} batches with {avgModelConfidence.toFixed(0)}% reliability
              </p>
              {avgModelConfidence < 80 && (
                <p className="text-xs text-muted-foreground mt-1">
                  💡 Prediction accuracy will improve in approximately {getDaysUntilBetterAccuracy(avgModelConfidence)} days as more transaction data is collected
                </p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center px-4 py-2 bg-card rounded-lg border">
                <p className="text-xs text-muted-foreground">Critical Items</p>
                <p className="text-2xl font-medium text-destructive">{criticalItems.length}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetrain}
                disabled={isRetraining}
                className="hover:scale-105 transition-transform"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRetraining ? 'animate-spin' : ''}`} />
                Update
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* At-Risk Drugs Grid */}
      {atRiskDrugs.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {atRiskDrugs.map(({ forecast }) => {
            const batch = forecast.mostCriticalBatch;

            // Calculate days until expiry for the most critical batch
            const daysUntilExpiry = batch.expiryDate
              ? Math.floor((new Date(batch.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null;

            return (
              <Card
                key={forecast.drugId}
                className={`card-hover transition-all duration-300 ${forecast.riskLevel === 'critical'
                  ? 'border-destructive/50 bg-destructive/5'
                  : forecast.riskLevel === 'high'
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border'
                  }`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-lg">{batch.brandName}</CardTitle>
                        <Badge
                          variant={forecast.riskLevel === 'critical' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {forecast.riskLevel.toUpperCase()}
                        </Badge>
                      </div>
                      <CardDescription>
                        {forecast.genericName}
                      </CardDescription>
                    </div>
                    <AlertTriangle
                      className={`h-5 w-5 ${forecast.riskLevel === 'critical' ? 'text-destructive' : 'text-primary'
                        }`}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-secondary/20 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Current Stock</p>
                      <p className="text-xl font-medium">{forecast.currentStock}</p>
                      <p className="text-xs text-muted-foreground">units</p>
                    </div>
                    <div className="p-3 bg-secondary/20 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Restock By</p>
                      {forecast.nextRestockDate ? (
                        <>
                          <p className="text-xl font-medium text-destructive">
                            {formatDate(forecast.nextRestockDate)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ~{Math.floor((new Date(forecast.nextRestockDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground mt-1">Adequate</p>
                      )}
                    </div>
                  </div>

                  {/* Prediction Reliability */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Prediction Reliability</span>
                      <span className="font-medium">{forecast.modelConfidence.toFixed(0)}%</span>
                    </div>
                    <Progress value={forecast.modelConfidence} className="h-2" />
                    {forecast.modelConfidence < 80 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Will improve in ~{getDaysUntilBetterAccuracy(forecast.modelConfidence)} days
                      </p>
                    )}
                  </div>

                  {/* Mini Forecast Chart */}
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={forecast.predictions.slice(0, 30)}>
                        <defs>
                          <linearGradient id={`gradient-${forecast.drugId}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.3} />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(date) => formatDate(date)}
                          tick={{ fontSize: 10 }}
                          stroke="var(--color-muted-foreground)"
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          stroke="var(--color-muted-foreground)"
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload[0]) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-card border rounded-lg p-2 shadow-lg text-xs">
                                  <p className="font-medium">
                                    {formatDate(data.date)}
                                  </p>
                                  <p className="text-muted-foreground">
                                    Stock: <span className="font-medium">{data.stockLevel.toFixed(1)}</span> units
                                  </p>
                                  <p className="text-muted-foreground">
                                    Daily usage: <span className="font-medium">{data.predictedDemand.toFixed(1)}</span> units
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="stockLevel"
                          stroke="var(--color-primary)"
                          strokeWidth={2}
                          fill={`url(#gradient-${forecast.drugId})`}
                        />
                        {forecast.reorderPoint && (
                          <ReferenceLine
                            y={forecast.reorderPoint}
                            stroke="var(--color-destructive)"
                            strokeDasharray="3 3"
                            label={{
                              value: 'Reorder Point',
                              fontSize: 10,
                              fill: 'var(--color-destructive)'
                            }}
                          />
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Package className="h-16 w-16 mx-auto mb-4 opacity-50 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">No At-Risk Medications</p>
            <p className="text-sm text-muted-foreground">
              All medications have adequate stock levels and are not near expiration
            </p>
          </CardContent>
        </Card>
      )}

      {/* Critical Alerts List */}
      {criticalItems.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle>Critical Alerts</CardTitle>
            </div>
            <CardDescription>
              These medications require immediate attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {criticalItems.map(forecast => {
                const representativeBatch = forecast.mostCriticalBatch;

                return (
                  <div
                    key={forecast.drugId}
                    className="flex items-center justify-between p-3 bg-destructive/5 rounded-lg border border-destructive/20"
                  >
                    <div>
                      <p className="font-medium">{representativeBatch.brandName}</p>
                      <p className="text-sm text-muted-foreground">
                        {forecast.genericName} • {forecast.currentStock} units
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-destructive">
                        {forecast.currentStock} units remaining
                      </p>
                      {forecast.nextRestockDate && (
                        <p className="text-xs text-muted-foreground">
                          Restock by {formatDate(forecast.nextRestockDate)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

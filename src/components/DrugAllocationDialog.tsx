import { useState } from 'react';
import { formatDate } from '../utils/dateFormatter';
import { InventoryItem } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { groupInventoryByDrug, allocateBatchesFEFO, BatchAllocation } from '../utils/batchManagement';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface DrugAllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inventory: InventoryItem[];
  onConfirm: (allocations: BatchAllocation[]) => void;
}

export function DrugAllocationDialog({ open, onOpenChange, inventory, onConfirm }: DrugAllocationDialogProps) {
  const [selectedDrug, setSelectedDrug] = useState<{ genericName: string; brandName: string; strength: string } | null>(null);
  const [quantity, setQuantity] = useState(0);
  const [allocations, setAllocations] = useState<BatchAllocation[] | null>(null);

  const drugGroups = groupInventoryByDrug(inventory);

  const handleDrugSelect = (drug: { genericName: string; brandName: string; strength: string }) => {
    setSelectedDrug(drug);
    setQuantity(0);
    setAllocations(null);
  };

  const handleCalculateAllocation = () => {
    if (!selectedDrug || quantity <= 0) return;

    const result = allocateBatchesFEFO(
      inventory,
      selectedDrug.genericName,
      selectedDrug.brandName,
      selectedDrug.strength,
      quantity
    );

    setAllocations(result);
  };

  const handleConfirm = () => {
    if (!allocations) return;
    onConfirm(allocations);
    handleReset();
    onOpenChange(false);
  };

  const handleReset = () => {
    setSelectedDrug(null);
    setQuantity(0);
    setAllocations(null);
  };

  const availableStock = selectedDrug
    ? drugGroups.find(g =>
      g.genericName === selectedDrug.genericName &&
      g.brandName === selectedDrug.brandName &&
      g.strength === selectedDrug.strength
    )?.totalQuantity || 0
    : 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
      if (!isOpen) handleReset();
    }}>
      <DialogContent className="w-[95vw] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Drug to Transaction (FEFO Allocation)</DialogTitle>
          <DialogDescription>
            Select a drug and quantity. The system will automatically allocate from batches with earliest expiry dates first.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Drug Selection */}
          <div className="space-y-2">
            <Label>Select Drug</Label>
            <div className="border rounded-lg max-h-60 overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-white">
                  <TableRow>
                    <TableHead>Generic Name</TableHead>
                    <TableHead>Brand Name</TableHead>
                    <TableHead>Strength</TableHead>
                    <TableHead>Total Stock</TableHead>
                    <TableHead>Batches</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drugGroups.filter(g => g.totalQuantity > 0).map((drug, idx) => {
                    const isSelected = selectedDrug?.genericName === drug.genericName &&
                      selectedDrug?.brandName === drug.brandName &&
                      selectedDrug?.strength === drug.strength;
                    return (
                      <TableRow
                        key={idx}
                        className={isSelected ? 'bg-blue-50' : ''}
                      >
                        <TableCell>{drug.genericName}</TableCell>
                        <TableCell>{drug.brandName}</TableCell>
                        <TableCell>{drug.strength}</TableCell>
                        <TableCell>{drug.totalQuantity}</TableCell>
                        <TableCell className="text-sm text-gray-500">{drug.batches.length} batch(es)</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant={isSelected ? 'default' : 'outline'}
                            onClick={() => handleDrugSelect({
                              genericName: drug.genericName,
                              brandName: drug.brandName,
                              strength: drug.strength
                            })}
                          >
                            {isSelected ? 'Selected' : 'Select'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Quantity Input */}
          {selectedDrug && (
            <>
              <div className="space-y-2">
                <Label htmlFor="quantity">
                  Quantity (Available: {availableStock})
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="quantity"
                    type="number"
                    step="0.01"
                    value={quantity}
                    onChange={(e) => {
                      setQuantity(parseFloat(e.target.value) || 0);
                      setAllocations(null);
                    }}
                    placeholder="Enter quantity"
                    max={availableStock}
                  />
                  <Button onClick={handleCalculateAllocation} disabled={quantity <= 0 || quantity > availableStock}>
                    Calculate Allocation
                  </Button>
                </div>
                {quantity > availableStock && (
                  <p className="text-sm text-red-600">
                    Requested quantity exceeds available stock
                  </p>
                )}
              </div>

              {/* Allocation Result */}
              {allocations && (
                <div className="space-y-3">
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      Allocation successful! The quantity will be automatically distributed across {allocations.length} batch(es) using FEFO logic.
                    </AlertDescription>
                  </Alert>

                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Batch Number</TableHead>
                          <TableHead>Quantity to Use</TableHead>
                          <TableHead>Expiry Date</TableHead>
                          <TableHead>Order</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allocations.map((allocation, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{allocation.batchNumber}</TableCell>
                            <TableCell>{allocation.quantity}</TableCell>
                            <TableCell>
                              {allocation.expiryDate ? formatDate(allocation.expiryDate) : 'N/A'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {idx === 0 ? 'Expires First' : `${idx + 1}${idx === 1 ? 'nd' : idx === 2 ? 'rd' : 'th'}`}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {allocations === null && quantity > 0 && quantity <= availableStock && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Click "Calculate Allocation" to see how the quantity will be distributed across batches.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => {
            handleReset();
            onOpenChange(false);
          }}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!allocations}>
            Confirm & Add to Transaction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

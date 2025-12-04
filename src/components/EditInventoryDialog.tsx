import { useState, useEffect } from 'react';
import { InventoryItem } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';

interface EditInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItem | null;
  onSave: (updatedItem: InventoryItem) => void;
}

export function EditInventoryDialog({ open, onOpenChange, item, onSave }: EditInventoryDialogProps) {
  const [formData, setFormData] = useState<{
    quantity: number | string;
    reorderLevel: number | string;
    expiryDate: string;
    notes: string;
  }>({
    quantity: 0,
    reorderLevel: 10,
    expiryDate: '',
    notes: ''
  });

  useEffect(() => {
    if (item) {
      setFormData({
        quantity: item.quantity,
        reorderLevel: item.reorderLevel,
        expiryDate: item.expiryDate || item.expirationDate || '',
        notes: item.notes || ''
      });
    }
  }, [item]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;

    const updatedItem: InventoryItem = {
      ...item,
      quantity: Number(formData.quantity),
      reorderLevel: Number(formData.reorderLevel),
      expiryDate: formData.expiryDate,
      expirationDate: formData.expiryDate, // Maintain compatibility
      notes: formData.notes
    };

    onSave(updatedItem);
    onOpenChange(false);
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Inventory Item</DialogTitle>
          <DialogDescription>
            Update details for {item.genericName} ({item.brandName}) - Batch {item.batchNumber}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-quantity" className="text-right">
                Quantity
              </Label>
              <Input
                id="edit-quantity"
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-reorder" className="text-right">
                Reorder Level
              </Label>
              <Input
                id="edit-reorder"
                type="number"
                value={formData.reorderLevel}
                onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-expiry" className="text-right">
                Expiry Date
              </Label>
              <Input
                id="edit-expiry"
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-notes" className="text-right">
                Notes
              </Label>
              <Textarea
                id="edit-notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

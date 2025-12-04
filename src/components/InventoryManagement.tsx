import { useState } from 'react';
import { formatDate } from '../utils/dateFormatter';
import { InventoryItem, InventoryTransaction } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Package, Plus, ArrowDownCircle, ArrowUpCircle, Search, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { InventoryForecast } from './InventoryForecast';
import { InventoryCombobox } from './InventoryCombobox';
import { DrugCombobox } from './DrugCombobox';
import { StockMovementHistory } from './StockMovementHistory';
import { GroupedInventoryView } from './GroupedInventoryView';
import { EditInventoryDialog } from './EditInventoryDialog';
import { Edit } from 'lucide-react';

interface InventoryManagementProps {
  inventory: InventoryItem[];
  transactions: InventoryTransaction[];
  onAddInventoryItem: (item: InventoryItem) => void;
  onUpdateInventoryItem: (item: InventoryItem) => void;
  onAddTransaction: (transaction: InventoryTransaction) => void;
  initialTab?: string;
  filterTransactionId?: string;
  filterDate?: string;
}

export function InventoryManagement({
  inventory,
  transactions,
  onAddInventoryItem,
  onUpdateInventoryItem,
  onAddTransaction,
  initialTab = 'inventory',
  filterTransactionId,
  filterDate
}: InventoryManagementProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<'IN' | 'OUT'>('IN');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedDrugKey, setSelectedDrugKey] = useState(''); // For Stock IN: drug selection
  const [selectedDrugInfo, setSelectedDrugInfo] = useState<{ genericName: string; brandName: string; strength: string } | null>(null);
  const [viewMode, setViewMode] = useState<'grouped' | 'batch'>('grouped');
  const [activeTab, setActiveTab] = useState(initialTab);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const [formData, setFormData] = useState<{
    genericName: string;
    brandName: string;
    strength: string;
    batchNumber: string;
    quantity: number;
    expirationDate: string;
    dateReceived: string;
    storageLocation: string;
    drugClass: string;
    reorderLevel: number | string;
    notes: string;
  }>({
    genericName: '',
    brandName: '',
    strength: '',
    batchNumber: '',
    quantity: 0,
    expirationDate: '',
    dateReceived: new Date().toISOString().split('T')[0],
    storageLocation: '',
    drugClass: '',
    reorderLevel: 10,
    notes: ''
  });

  const [transactionData, setTransactionData] = useState({
    quantity: 0,
    reason: '',
    patientId: '',
    batchNumber: '',
    expiryDate: ''
  });

  // Confirmation dialog state
  const [confirmAction, setConfirmAction] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => { }
  });

  const handleBatchNumberChange = (batchNumber: string) => {
    setTransactionData(prev => ({ ...prev, batchNumber, expiryDate: '' }));

    // Auto-fill expiry date if batch exists for the selected drug (for Stock IN)
    if (transactionType === 'IN' && selectedDrugInfo && batchNumber) {
      // Find any existing batch with the same batch number for this drug
      const existingBatch = inventory.find(i =>
        i.genericName === selectedDrugInfo.genericName &&
        i.brandName === selectedDrugInfo.brandName &&
        i.strength === selectedDrugInfo.strength &&
        i.batchNumber === batchNumber
      );

      if (existingBatch) {
        const expiryDate = existingBatch.expiryDate || existingBatch.expirationDate;
        if (expiryDate) {
          setTransactionData(prev => ({ ...prev, batchNumber, expiryDate }));
          toast.info(`Existing batch found! Expiry: ${formatDate(expiryDate)}. Stock will be added to this batch.`);
        } else {
          toast.warning('Existing batch found but no expiry date. Please enter expiry date.');
        }
      }
    }
  };

  const handleSubmitItem = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.genericName || !formData.brandName || !formData.batchNumber) {
      toast.error('Please fill in required fields');
      return;
    }

    // Check for existing batch
    const existingBatch = inventory.find(i =>
      i.genericName.toLowerCase() === formData.genericName.toLowerCase() &&
      i.brandName.toLowerCase() === formData.brandName.toLowerCase() &&
      i.strength.toLowerCase() === formData.strength.toLowerCase() &&
      i.batchNumber.toLowerCase() === formData.batchNumber.toLowerCase()
    );

    if (existingBatch) {
      setConfirmAction({
        open: true,
        title: 'Duplicate Batch Found',
        description: `A batch with number "${formData.batchNumber}" already exists for ${formData.genericName} (${formData.brandName}). Do you want to update the existing batch instead?`,
        onConfirm: () => {
          // Close add dialog and open stock movement
          setIsAddDialogOpen(false);
          setTransactionType('IN');
          setSelectedDrugKey(`${existingBatch.genericName}|${existingBatch.brandName}|${existingBatch.strength}`);
          setSelectedDrugInfo({
            genericName: existingBatch.genericName,
            brandName: existingBatch.brandName,
            strength: existingBatch.strength
          });
          setTransactionData(prev => ({
            ...prev,
            batchNumber: existingBatch.batchNumber,
            expiryDate: existingBatch.expiryDate || existingBatch.expirationDate || ''
          }));
          setIsTransactionDialogOpen(true);
          setConfirmAction({ ...confirmAction, open: false });
        }
      });
      return;
    }

    const newItem: InventoryItem = {
      id: `inv-${Date.now()}`,
      ...formData,
      reorderLevel: Number(formData.reorderLevel),
      expiryDate: formData.expirationDate
    };

    onAddInventoryItem(newItem);

    // Create a stock-in transaction if quantity > 0
    if (formData.quantity > 0) {
      const stockInTransaction: InventoryTransaction = {
        id: `trans-${Date.now()}`,
        inventoryItemId: newItem.id,
        type: 'IN',
        quantity: formData.quantity,
        date: new Date().toISOString(),
        reason: 'Initial stock registration',
        batchNumber: formData.batchNumber
      };
      onAddTransaction(stockInTransaction);
      toast.success(`Inventory item registered with ${formData.quantity} units in stock`);
    } else {
      toast.success('Inventory item registered successfully');
    }

    setIsAddDialogOpen(false);
    setFormData({
      genericName: '',
      brandName: '',
      strength: '',
      batchNumber: '',
      quantity: 0,
      expirationDate: '',
      dateReceived: new Date().toISOString().split('T')[0],
      storageLocation: '',
      drugClass: '',
      reorderLevel: 10,
      notes: ''
    });
  };

  const handleTransaction = (e: React.FormEvent) => {
    e.preventDefault();

    if (!transactionData.quantity) {
      toast.error('Please enter quantity');
      return;
    }

    // Validation for Stock IN
    if (transactionType === 'IN') {
      if (!selectedDrugInfo) {
        toast.error('Please select a drug');
        return;
      }
      if (!transactionData.batchNumber) {
        toast.error('Batch number is required for stock in');
        return;
      }
      if (!transactionData.expiryDate) {
        toast.error('Expiry date is required for stock in');
        return;
      }

      // Show confirmation dialog for Stock IN
      const actionDescription = `add ${transactionData.quantity} units of ${selectedDrugInfo.genericName} (${selectedDrugInfo.brandName}) to batch ${transactionData.batchNumber}`;

      setConfirmAction({
        open: true,
        title: 'Confirm Stock IN',
        description: `Are you sure you want to ${actionDescription}?`,
        onConfirm: () => {
          executeStockIn();
          setConfirmAction({ ...confirmAction, open: false });
        }
      });
    } else {
      // Validation for Stock OUT
      const item = inventory.find(i => i.id === selectedItemId);
      if (!item) {
        toast.error('Please select an item');
        return;
      }
      if (!transactionData.reason) {
        toast.error('Please enter reason for stock removal');
        return;
      }
      if (transactionData.quantity > item.quantity) {
        toast.error('Insufficient quantity in stock');
        return;
      }

      // Show confirmation dialog for Stock OUT
      const actionDescription = `remove ${transactionData.quantity} units of ${item.genericName} (${item.brandName}) from stock. Reason: ${transactionData.reason}`;

      setConfirmAction({
        open: true,
        title: 'Confirm Stock OUT',
        description: `Are you sure you want to ${actionDescription}?`,
        onConfirm: () => {
          executeStockOut(item);
          setConfirmAction({ ...confirmAction, open: false });
        }
      });
    }
  };

  const executeStockIn = () => {
    if (!selectedDrugInfo) return;

    // Check if the same batch already exists for this drug
    const existingBatch = inventory.find(i =>
      i.genericName === selectedDrugInfo.genericName &&
      i.brandName === selectedDrugInfo.brandName &&
      i.strength === selectedDrugInfo.strength &&
      i.batchNumber === transactionData.batchNumber
    );

    if (existingBatch) {
      // Update existing batch
      const transaction: InventoryTransaction = {
        id: `trans-${Date.now()}`,
        inventoryItemId: existingBatch.id,
        type: 'IN',
        quantity: transactionData.quantity,
        date: new Date().toISOString(),
        reason: transactionData.reason || 'Stock IN',
        batchNumber: transactionData.batchNumber
      };

      onUpdateInventoryItem({
        ...existingBatch,
        quantity: existingBatch.quantity + transactionData.quantity,
        expiryDate: transactionData.expiryDate // Update expiry date if changed
      });

      onAddTransaction(transaction);
      toast.success(`Stock added to existing batch ${transactionData.batchNumber} (Current stock: ${existingBatch.quantity + transactionData.quantity})`);
    } else {
      // Create new batch (new inventory item)
      // Get default values from any existing item of this drug
      const referenceItem = inventory.find(i =>
        i.genericName === selectedDrugInfo.genericName &&
        i.brandName === selectedDrugInfo.brandName &&
        i.strength === selectedDrugInfo.strength
      );

      const newInventoryItem: InventoryItem = {
        id: `inv-${Date.now()}`,
        genericName: selectedDrugInfo.genericName,
        brandName: selectedDrugInfo.brandName,
        strength: selectedDrugInfo.strength,
        batchNumber: transactionData.batchNumber,
        quantity: transactionData.quantity,
        expiryDate: transactionData.expiryDate,
        expirationDate: transactionData.expiryDate,
        dateReceived: new Date().toISOString().split('T')[0],
        storageLocation: referenceItem?.storageLocation || '',
        drugClass: referenceItem?.drugClass || '',
        reorderLevel: referenceItem?.reorderLevel || 10,
        notes: referenceItem?.notes || ''
      };

      onAddInventoryItem(newInventoryItem);

      const transaction: InventoryTransaction = {
        id: `trans-${Date.now()}`,
        inventoryItemId: newInventoryItem.id,
        type: 'IN',
        quantity: transactionData.quantity,
        date: new Date().toISOString(),
        reason: transactionData.reason || 'New batch registration',
        batchNumber: transactionData.batchNumber
      };

      onAddTransaction(transaction);
      toast.success(`New batch ${transactionData.batchNumber} created with ${transactionData.quantity} units`);
    }

    setIsTransactionDialogOpen(false);
    setSelectedDrugKey('');
    setSelectedDrugInfo(null);
    setTransactionData({
      quantity: 0,
      reason: '',
      patientId: '',
      batchNumber: '',
      expiryDate: ''
    });
  };

  const executeStockOut = (item: InventoryItem) => {
    // Handle Stock OUT
    const transaction: InventoryTransaction = {
      id: `trans-${Date.now()}`,
      inventoryItemId: selectedItemId,
      type: 'OUT',
      quantity: transactionData.quantity,
      date: new Date().toISOString(),
      reason: transactionData.reason,
      patientId: transactionData.patientId || undefined,
      batchNumber: transactionData.batchNumber || item.batchNumber
    };

    onUpdateInventoryItem({
      ...item,
      quantity: item.quantity - transactionData.quantity
    });

    onAddTransaction(transaction);
    toast.success('Stock removed successfully');

    setIsTransactionDialogOpen(false);
    setSelectedItemId('');
    setTransactionData({
      quantity: 0,
      reason: '',
      patientId: '',
      batchNumber: '',
      expiryDate: ''
    });
  };

  const filteredInventory = inventory.filter(item =>
    item.genericName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.brandName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.batchNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group batches by generic name for low stock display
  const getLowStockItems = () => {
    const grouped = new Map<string, { genericName: string; totalQuantity: number; reorderLevel: number }>();

    inventory.forEach(item => {
      if (!grouped.has(item.genericName)) {
        grouped.set(item.genericName, {
          genericName: item.genericName,
          totalQuantity: item.quantity,
          reorderLevel: item.reorderLevel
        });
      } else {
        const existing = grouped.get(item.genericName)!;
        existing.totalQuantity += item.quantity;
      }
    });

    // Filter to only items below reorder level
    return Array.from(grouped.values()).filter(item => item.totalQuantity <= item.reorderLevel);
  };

  const getExpiringSoonItems = () => {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return inventory.filter(item => {
      const expiryDate = item.expiryDate || item.expirationDate;
      if (!expiryDate) return false;
      // Only show items with quantity > 0
      if (item.quantity <= 0) return false;
      const expDate = new Date(expiryDate);
      expDate.setHours(0, 0, 0, 0);
      // Include items that expire within 30 days OR have already expired
      return expDate <= thirtyDaysFromNow;
    }).sort((a, b) => {
      const dateA = new Date(a.expiryDate || a.expirationDate || '');
      const dateB = new Date(b.expiryDate || b.expirationDate || '');
      return dateA.getTime() - dateB.getTime(); // Sort by expiry date (earliest first)
    });
  };

  // Handle destroying expired batch
  const handleDestroyBatch = (item: InventoryItem) => {
    const expiryDate = item.expiryDate || item.expirationDate;
    setConfirmAction({
      open: true,
      title: 'Destroy Expired Batch',
      description: `Are you sure you want to destroy ${item.quantity} units of ${item.genericName} (${item.brandName}) from batch ${item.batchNumber}? This action cannot be undone. The stock will be recorded as destroyed and removed from inventory.`,
      onConfirm: () => {
        // Create stock OUT transaction for destruction
        const transaction: InventoryTransaction = {
          id: `trans-${Date.now()}`,
          inventoryItemId: item.id,
          type: 'OUT',
          quantity: item.quantity,
          date: new Date().toISOString(),
          reason: `Destroyed - Expired on ${expiryDate ? formatDate(expiryDate) : 'N/A'}`,
          batchNumber: item.batchNumber
        };

        // Update inventory to 0 quantity
        onUpdateInventoryItem({
          ...item,
          quantity: 0
        });

        onAddTransaction(transaction);
        toast.success(`Batch ${item.batchNumber} destroyed and removed from inventory`);
        setConfirmAction({ ...confirmAction, open: false });
      }
    });
  };

  const handleSaveEdit = (updatedItem: InventoryItem) => {
    onUpdateInventoryItem(updatedItem);
    toast.success('Inventory item updated successfully');
  };

  const handleUpdateDrugNotes = (genericName: string, brandName: string, strength: string, newNote: string) => {
    // Find all items for this drug
    const itemsToUpdate = inventory.filter(item =>
      item.genericName === genericName &&
      item.brandName === brandName &&
      item.strength === strength
    );

    // Update each item
    itemsToUpdate.forEach(item => {
      onUpdateInventoryItem({
        ...item,
        notes: newNote
      });
    });

    toast.success('Notes updated for all batches');
  };

  const handleUpdateDrugStorageLocation = (genericName: string, brandName: string, strength: string, newLocation: string) => {
    // Find all items for this drug
    const itemsToUpdate = inventory.filter(item =>
      item.genericName === genericName &&
      item.brandName === brandName &&
      item.strength === strength
    );

    // Update each item
    itemsToUpdate.forEach(item => {
      onUpdateInventoryItem({
        ...item,
        storageLocation: newLocation
      });
    });

    toast.success('Storage location updated for all batches');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Inventory Management</CardTitle>
          <CardDescription>Track and manage pharmaceutical inventory</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by drug name, generic name, or batch..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add Inventory Item</DialogTitle>
                  <DialogDescription>Enter complete drug information</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmitItem} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="genericName">Generic Name *</Label>
                      <Input
                        id="genericName"
                        value={formData.genericName}
                        onChange={(e) => setFormData({ ...formData, genericName: e.target.value })}
                        required
                        placeholder="e.g., Paracetamol"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="brandName">Brand Name *</Label>
                      <Input
                        id="brandName"
                        value={formData.brandName}
                        onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                        required
                        placeholder="e.g., Panadol"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="strength">Strength/Dosage</Label>
                      <Input
                        id="strength"
                        value={formData.strength}
                        onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                        placeholder="e.g., 500mg/10mL"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="batchNumber">Batch/Lot Number *</Label>
                      <Input
                        id="batchNumber"
                        value={formData.batchNumber}
                        onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quantity">Initial Quantity</Label>
                      <Input
                        id="quantity"
                        type="number"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expirationDate">Expiration Date</Label>
                      <Input
                        id="expirationDate"
                        type="date"
                        value={formData.expirationDate}
                        onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dateReceived">Date Received</Label>
                      <Input
                        id="dateReceived"
                        type="date"
                        value={formData.dateReceived}
                        onChange={(e) => setFormData({ ...formData, dateReceived: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="storageLocation">Storage Location</Label>
                      <Input
                        id="storageLocation"
                        value={formData.storageLocation}
                        onChange={(e) => setFormData({ ...formData, storageLocation: e.target.value })}
                        placeholder="Refrigerator A, Shelf 2"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="drugClass">Drug Classification</Label>
                      <Input
                        id="drugClass"
                        value={formData.drugClass}
                        onChange={(e) => setFormData({ ...formData, drugClass: e.target.value })}
                        placeholder="e.g., Vitamin, Antibiotic"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reorderLevel">Reorder Level</Label>
                      <Input
                        id="reorderLevel"
                        type="number"
                        value={formData.reorderLevel}
                        onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Special storage requirements, contraindications, etc."
                      rows={2}
                    />
                  </div>
                  <Button type="submit" className="w-full">Add to Inventory</Button>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={isTransactionDialogOpen} onOpenChange={(open) => {
              setIsTransactionDialogOpen(open);
              if (!open) {
                // Reset form when closing
                setSelectedItemId('');
                setSelectedDrugKey('');
                setSelectedDrugInfo(null);
                setTransactionData({
                  quantity: 0,
                  reason: '',
                  patientId: '',
                  batchNumber: '',
                  expiryDate: ''
                });
              }
            }}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Package className="w-4 h-4 mr-2" />
                  Stock Movement
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Stock Movement</DialogTitle>
                  <DialogDescription>Record stock in or out</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleTransaction} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Transaction Type</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={transactionType === 'IN' ? 'default' : 'outline'}
                        onClick={() => setTransactionType('IN')}
                        className="flex-1"
                      >
                        <ArrowDownCircle className="w-4 h-4 mr-2" />
                        Stock IN
                      </Button>
                      <Button
                        type="button"
                        variant={transactionType === 'OUT' ? 'default' : 'outline'}
                        onClick={() => setTransactionType('OUT')}
                        className="flex-1"
                      >
                        <ArrowUpCircle className="w-4 h-4 mr-2" />
                        Stock OUT
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {transactionType === 'IN' ? (
                      <>
                        <Label>Select Drug *</Label>
                        <DrugCombobox
                          inventory={inventory}
                          value={selectedDrugKey}
                          onSelect={(key, drugInfo) => {
                            setSelectedDrugKey(key);
                            setSelectedDrugInfo(drugInfo);
                            // Clear batch and expiry when changing drug
                            setTransactionData(prev => ({ ...prev, batchNumber: '', expiryDate: '' }));
                          }}
                          placeholder="Search drug..."
                        />
                        {selectedDrugKey && (
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900">
                            <p><strong>Stock IN Logic:</strong></p>
                            <p>• If batch number exists for this drug → adds to existing batch</p>
                            <p>• If batch number is new → creates new batch entry</p>
                            <p>• Expiry date will auto-fill if batch already exists</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <Label>Select Item *</Label>
                        <InventoryCombobox
                          inventory={inventory}
                          value={selectedItemId}
                          onValueChange={(id) => {
                            setSelectedItemId(id);
                            // Clear batch when changing item
                            setTransactionData(prev => ({ ...prev, batchNumber: '' }));
                          }}
                          placeholder="Search inventory item..."
                        />
                      </>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="transQuantity">Quantity *</Label>
                    <Input
                      id="transQuantity"
                      type="number"
                      step="0.01"
                      value={transactionData.quantity}
                      onChange={(e) => setTransactionData({ ...transactionData, quantity: parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>
                  {transactionType === 'IN' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="batchNumber">Batch Number *</Label>
                        <Input
                          id="batchNumber"
                          value={transactionData.batchNumber}
                          onChange={(e) => handleBatchNumberChange(e.target.value)}
                          placeholder="Enter batch/lot number"
                          required={transactionType === 'IN'}
                        />
                        {transactionData.batchNumber && selectedDrugInfo && (() => {
                          const existingBatch = inventory.find(i =>
                            i.genericName === selectedDrugInfo.genericName &&
                            i.brandName === selectedDrugInfo.brandName &&
                            i.strength === selectedDrugInfo.strength &&
                            i.batchNumber === transactionData.batchNumber
                          );

                          if (existingBatch) {
                            return (
                              <div className="p-2 bg-green-50 border border-green-200 rounded text-xs text-green-900">
                                <p><strong>✓ Existing Batch Found</strong></p>
                                <p>Batch: {existingBatch.batchNumber} | Current stock: {existingBatch.quantity} units</p>
                                <p>Expiry: {existingBatch.expiryDate ? formatDate(existingBatch.expiryDate) : 'N/A'}</p>
                                <p className="mt-1 font-medium">Stock will be added to this batch</p>
                              </div>
                            );
                          } else {
                            return (
                              <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-900">
                                <p><strong>⚡ New Batch</strong></p>
                                <p>This batch doesn't exist yet. A new batch entry will be created.</p>
                              </div>
                            );
                          }
                        })()}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="expiryDate">Expiry Date *</Label>
                        <Input
                          id="expiryDate"
                          type="date"
                          value={transactionData.expiryDate}
                          onChange={(e) => setTransactionData({ ...transactionData, expiryDate: e.target.value })}
                          required={transactionType === 'IN'}
                        />
                        {transactionData.expiryDate && (
                          <p className="text-xs text-green-700">
                            ✓ Expires: {new Date(transactionData.expiryDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                  {transactionType === 'OUT' && (
                    <div className="space-y-2">
                      <Label htmlFor="batchNumber">Batch Number</Label>
                      <Input
                        id="batchNumber"
                        value={transactionData.batchNumber}
                        onChange={(e) => setTransactionData({ ...transactionData, batchNumber: e.target.value })}
                        placeholder="Leave empty to use item's batch"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="reason">
                      Reason {transactionType === 'OUT' && '*'}
                    </Label>
                    <Input
                      id="reason"
                      value={transactionData.reason}
                      onChange={(e) => setTransactionData({ ...transactionData, reason: e.target.value })}
                      placeholder={transactionType === 'IN' ? 'e.g., New shipment (optional)' : 'e.g., Patient treatment, Expired'}
                      required={transactionType === 'OUT'}
                    />
                  </div>
                  {transactionType === 'OUT' && (
                    <div className="space-y-2">
                      <Label htmlFor="patientId">Patient ID (optional)</Label>
                      <Input
                        id="patientId"
                        value={transactionData.patientId}
                        onChange={(e) => setTransactionData({ ...transactionData, patientId: e.target.value })}
                        placeholder="For patient treatments"
                      />
                    </div>
                  )}
                  <Button type="submit" className="w-full">Record Transaction</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="stock-movement">Stock Movement</TabsTrigger>
              <TabsTrigger value="forecast">Forecast & Alerts</TabsTrigger>
              <TabsTrigger value="low-stock">Low Stock</TabsTrigger>
              <TabsTrigger value="expiring">Expiring Soon</TabsTrigger>
            </TabsList>

            <TabsContent value="inventory" className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-600">
                  {viewMode === 'grouped' ? 'Grouped by Drug (showing total stock across batches)' : 'Showing individual batches'}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant={viewMode === 'grouped' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('grouped')}
                  >
                    Grouped View
                  </Button>
                  <Button
                    variant={viewMode === 'batch' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('batch')}
                  >
                    Batch View
                  </Button>
                </div>
              </div>

              {viewMode === 'grouped' ? (
                <GroupedInventoryView
                  inventory={inventory}
                  searchTerm={searchTerm}
                  onEdit={(item) => setEditingItem(item)}
                  onUpdateDrugNotes={handleUpdateDrugNotes}
                  onUpdateDrugStorageLocation={handleUpdateDrugStorageLocation}
                />
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Generic Name</TableHead>
                        <TableHead>Brand Name</TableHead>
                        <TableHead>Strength</TableHead>
                        <TableHead>Batch</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Expiry</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInventory.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-gray-500">
                            No inventory items found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredInventory.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.genericName}</TableCell>
                            <TableCell className="text-gray-600">{item.brandName}</TableCell>
                            <TableCell>{item.strength}</TableCell>
                            <TableCell>{item.batchNumber}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>{item.expiryDate || item.expirationDate || 'N/A'}</TableCell>
                            <TableCell>
                              {item.quantity <= item.reorderLevel ? (
                                <Badge variant="destructive">Low Stock</Badge>
                              ) : (
                                <Badge>In Stock</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingItem(item)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="stock-movement" className="space-y-4">
              <StockMovementHistory
                inventory={inventory}
                transactions={transactions}
                filterTransactionId={filterTransactionId}
                initialFilterDate={filterDate}
              />
            </TabsContent>

            <TabsContent value="forecast" className="space-y-4">
              <InventoryForecast inventory={inventory} transactions={transactions} />
            </TabsContent>

            <TabsContent value="low-stock" className="space-y-4">
              {getLowStockItems().length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-900">Low Stock Alert</h4>
                    <p className="text-yellow-700">{getLowStockItems().length} item(s) below reorder level</p>
                  </div>
                </div>
              )}
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Generic Name</TableHead>
                      <TableHead>Current Qty</TableHead>
                      <TableHead>Reorder Level</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getLowStockItems().length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-gray-500">
                          All items are adequately stocked
                        </TableCell>
                      </TableRow>
                    ) : (
                      getLowStockItems().map((item) => (
                        <TableRow key={item.genericName}>
                          <TableCell>{item.genericName}</TableCell>
                          <TableCell>{item.totalQuantity}</TableCell>
                          <TableCell>{item.reorderLevel}</TableCell>
                          <TableCell>
                            <Badge variant="destructive">Reorder Required</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="expiring" className="space-y-4">
              {getExpiringSoonItems().length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-orange-900">Expiration Alert</h4>
                    <p className="text-orange-700">
                      {getExpiringSoonItems().filter(i => {
                        const expDate = new Date(i.expiryDate || i.expirationDate || '');
                        expDate.setHours(0, 0, 0, 0);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        return expDate < today;
                      }).length} expired, {getExpiringSoonItems().filter(i => {
                        const expDate = new Date(i.expiryDate || i.expirationDate || '');
                        expDate.setHours(0, 0, 0, 0);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        return expDate >= today;
                      }).length} expiring within 30 days
                    </p>
                  </div>
                </div>
              )}
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Generic Name</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Expiration Date</TableHead>
                      <TableHead>Days Until Expiry</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getExpiringSoonItems().length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-gray-500">
                          No items expiring soon
                        </TableCell>
                      </TableRow>
                    ) : (
                      getExpiringSoonItems().map((item) => {
                        const expiryDate = item.expiryDate || item.expirationDate;
                        const expDate = new Date(expiryDate || '');
                        expDate.setHours(0, 0, 0, 0);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const daysUntilExpiry = Math.floor((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        const isExpired = expDate < today;

                        return (
                          <TableRow key={item.id} className={isExpired ? 'bg-destructive/5' : ''}>
                            <TableCell>{item.genericName}</TableCell>
                            <TableCell>{item.batchNumber}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>{expiryDate ? new Date(expiryDate).toLocaleDateString() : 'N/A'}</TableCell>
                            <TableCell>
                              {isExpired ? (
                                <Badge variant="destructive">EXPIRED</Badge>
                              ) : (
                                <Badge variant={daysUntilExpiry <= 7 ? 'destructive' : 'outline'}>
                                  {daysUntilExpiry} days
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {isExpired ? (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDestroyBatch(item)}
                                >
                                  Destroy
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmAction.open} onOpenChange={(open) => setConfirmAction({ ...confirmAction, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction.onConfirm}>Yes, Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditInventoryDialog
        open={!!editingItem}
        onOpenChange={(open) => !open && setEditingItem(null)}
        item={editingItem}
        onSave={handleSaveEdit}
      />
    </div >
  );
}

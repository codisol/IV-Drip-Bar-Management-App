import React, { useState } from 'react';
import { formatDate } from '../utils/dateFormatter';
import { InventoryItem } from '../types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { ChevronDown, ChevronRight, Edit, Save, X, FileText, MapPin } from 'lucide-react';
import { groupInventoryByDrug } from '../utils/batchManagement';

interface GroupedInventoryViewProps {
  inventory: InventoryItem[];
  searchTerm: string;
  onEdit?: (item: InventoryItem) => void;
  onUpdateDrugNotes?: (genericName: string, brandName: string, strength: string, newNote: string) => void;
  onUpdateDrugStorageLocation?: (genericName: string, brandName: string, strength: string, newLocation: string) => void;
}

export function GroupedInventoryView({ inventory, searchTerm, onEdit, onUpdateDrugNotes, onUpdateDrugStorageLocation }: GroupedInventoryViewProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [editingNoteKey, setEditingNoteKey] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState('');
  const [editingStorageKey, setEditingStorageKey] = useState<string | null>(null);
  const [storageValue, setStorageValue] = useState('');

  const toggleGroup = (key: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedGroups(newExpanded);
  };

  const startEditingNote = (key: string, currentNote: string) => {
    setEditingNoteKey(key);
    setNoteValue(currentNote || '');
  };

  const cancelEditingNote = () => {
    setEditingNoteKey(null);
    setNoteValue('');
  };

  const saveNote = (group: any) => {
    if (onUpdateDrugNotes) {
      onUpdateDrugNotes(group.genericName, group.brandName, group.strength, noteValue);
    }
    setEditingNoteKey(null);
  };

  const startEditingStorage = (key: string, currentLocation: string) => {
    setEditingStorageKey(key);
    setStorageValue(currentLocation || '');
  };

  const cancelEditingStorage = () => {
    setEditingStorageKey(null);
    setStorageValue('');
  };

  const saveStorage = (group: any) => {
    if (onUpdateDrugStorageLocation) {
      onUpdateDrugStorageLocation(group.genericName, group.brandName, group.strength, storageValue);
    }
    setEditingStorageKey(null);
  };

  const drugGroups = groupInventoryByDrug(inventory).filter(group =>
    group.genericName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.brandName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.batches.some(batch => batch.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStockStatus = (quantity: number, reorderLevel: number) => {
    if (quantity === 0) return <Badge variant="destructive">Out of Stock</Badge>;
    if (quantity <= reorderLevel) return <Badge variant="destructive">Low Stock</Badge>;
    return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">In Stock</Badge>;
  };

  const isExpiringSoon = (expiryDate: string) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return expiry <= thirtyDaysFromNow && expiry >= new Date();
  };

  const isExpired = (expiryDate: string) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>Generic Name</TableHead>
            <TableHead>Brand Name</TableHead>
            <TableHead>Strength</TableHead>
            <TableHead>Total Stock</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Batches</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {drugGroups.map((group) => {
            const groupKey = `${group.genericName}|${group.brandName}|${group.strength}`;
            const isExpanded = expandedGroups.has(groupKey);

            // Get note from the first batch (assuming all batches share the same note for the drug)
            // We need to find the actual inventory item to get the note, as group.batches might not have it if it wasn't mapped
            // But wait, groupInventoryByDrug in batchManagement.ts doesn't map 'notes'.
            // We need to find one item from the inventory list that matches this group.
            const representativeItem = inventory.find(i =>
              i.genericName === group.genericName &&
              i.brandName === group.brandName &&
              i.strength === group.strength
            );
            const currentNote = representativeItem?.notes || '';
            const currentStorage = representativeItem?.storageLocation || '';

            return (
              <React.Fragment key={groupKey}>
                <TableRow
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleGroup(groupKey)}
                >
                  <TableCell>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </TableCell>
                  <TableCell>{group.genericName}</TableCell>
                  <TableCell>{group.brandName}</TableCell>
                  <TableCell>{group.strength}</TableCell>
                  <TableCell>{group.totalQuantity}</TableCell>
                  <TableCell>{getStockStatus(group.totalQuantity, group.reorderLevel)}</TableCell>
                  <TableCell className="text-gray-500">{group.batches.length} batch(es)</TableCell>
                </TableRow>

                {isExpanded && (
                  <TableRow>
                    <TableCell colSpan={7} className="bg-gray-50 p-0">
                      <div className="px-4 py-3 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Storage Location Section */}
                          <div className="bg-white p-3 rounded-md border border-gray-200 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-medium flex items-center gap-2 text-gray-700">
                                <MapPin className="w-4 h-4" />
                                Storage Location
                              </h4>
                              {onUpdateDrugStorageLocation && editingStorageKey !== groupKey && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs"
                                  onClick={() => startEditingStorage(groupKey, currentStorage)}
                                >
                                  <Edit className="w-3 h-3 mr-1" />
                                  Edit
                                </Button>
                              )}
                            </div>

                            {editingStorageKey === groupKey ? (
                              <div className="space-y-2">
                                <Input
                                  value={storageValue}
                                  onChange={(e) => setStorageValue(e.target.value)}
                                  placeholder="e.g., Shelf A, Fridge 2..."
                                  className="text-sm h-8"
                                />
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={cancelEditingStorage}
                                    className="h-7 text-xs"
                                  >
                                    <X className="w-3 h-3 mr-1" />
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => saveStorage(group)}
                                    className="h-7 text-xs"
                                  >
                                    <Save className="w-3 h-3 mr-1" />
                                    Save
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-gray-600">
                                {currentStorage ? (
                                  currentStorage
                                ) : (
                                  <span className="text-gray-400 italic">No storage location set.</span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Notes Section */}
                          <div className="bg-white p-3 rounded-md border border-gray-200 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-medium flex items-center gap-2 text-gray-700">
                                <FileText className="w-4 h-4" />
                                Drug Notes
                              </h4>
                              {onUpdateDrugNotes && editingNoteKey !== groupKey && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs"
                                  onClick={() => startEditingNote(groupKey, currentNote)}
                                >
                                  <Edit className="w-3 h-3 mr-1" />
                                  Edit
                                </Button>
                              )}
                            </div>

                            {editingNoteKey === groupKey ? (
                              <div className="space-y-2">
                                <Textarea
                                  value={noteValue}
                                  onChange={(e) => setNoteValue(e.target.value)}
                                  placeholder="Add notes about this drug (e.g., storage instructions, side effects)..."
                                  className="text-sm min-h-[80px]"
                                />
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={cancelEditingNote}
                                    className="h-7 text-xs"
                                  >
                                    <X className="w-3 h-3 mr-1" />
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => saveNote(group)}
                                    className="h-7 text-xs"
                                  >
                                    <Save className="w-3 h-3 mr-1" />
                                    Save Note
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-gray-600 whitespace-pre-wrap">
                                {currentNote ? (
                                  currentNote
                                ) : (
                                  <span className="text-gray-400 italic">No notes added.</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Batches Table */}
                        <div>
                          <p className="text-xs text-gray-500 mb-2">Batch Details (ordered by expiry - FEFO):</p>
                          <div className="border rounded-md overflow-hidden bg-white">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs">Batch Number</TableHead>
                                  <TableHead className="text-xs">Quantity</TableHead>
                                  <TableHead className="text-xs">Expiry Date</TableHead>
                                  <TableHead className="text-xs">Received Date</TableHead>
                                  <TableHead className="text-xs">Status</TableHead>
                                  {onEdit && <TableHead className="text-xs">Actions</TableHead>}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {group.batches.map((batch) => (
                                  <TableRow key={batch.id}>
                                    <TableCell className="text-xs">{batch.batchNumber}</TableCell>
                                    <TableCell className="text-xs">{batch.quantity}</TableCell>
                                    <TableCell className="text-xs">
                                      {batch.expiryDate ? formatDate(batch.expiryDate) : 'N/A'}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                      {formatDate(batch.dateReceived)}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                      {isExpired(batch.expiryDate) ? (
                                        <Badge variant="destructive" className="text-xs">Expired</Badge>
                                      ) : isExpiringSoon(batch.expiryDate) ? (
                                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">
                                          Expiring Soon
                                        </Badge>
                                      ) : batch.quantity === 0 ? (
                                        <Badge variant="outline" className="text-xs">Empty</Badge>
                                      ) : (
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                                          Active
                                        </Badge>
                                      )}
                                    </TableCell>
                                    {onEdit && (
                                      <TableCell className="text-xs">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const fullItem = inventory.find(i => i.id === batch.id);
                                            if (fullItem) {
                                              onEdit(fullItem);
                                            }
                                          }}
                                        >
                                          <Edit className="h-3 w-3" />
                                        </Button>
                                      </TableCell>
                                    )}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}
          {drugGroups.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-gray-500">
                No inventory items found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

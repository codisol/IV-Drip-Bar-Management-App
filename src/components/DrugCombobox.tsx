import { useState } from 'react';
import { InventoryItem } from '../types';
import { Button } from './ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';

interface DrugComboboxProps {
  inventory: InventoryItem[];
  value: string;
  onSelect: (drugKey: string, drugInfo: { genericName: string; brandName: string; strength: string }) => void;
  placeholder?: string;
}

interface Drug {
  key: string;
  genericName: string;
  brandName: string;
  strength: string;
  totalStock: number;
  batchCount: number;
  storageLocation: string;
  drugClass: string;
  reorderLevel: number;
}

export function DrugCombobox({ inventory, value, onSelect, placeholder = 'Select drug...' }: DrugComboboxProps) {
  const [open, setOpen] = useState(false);

  // Group inventory by drug (generic name + brand name + strength)
  const drugs: Drug[] = (() => {
    const drugMap = new Map<string, Drug>();

    inventory.forEach(item => {
      const key = `${item.genericName}|${item.brandName}|${item.strength}`;
      
      if (!drugMap.has(key)) {
        drugMap.set(key, {
          key,
          genericName: item.genericName,
          brandName: item.brandName,
          strength: item.strength,
          totalStock: item.quantity,
          batchCount: 1,
          storageLocation: item.storageLocation,
          drugClass: item.drugClass,
          reorderLevel: item.reorderLevel
        });
      } else {
        const drug = drugMap.get(key)!;
        drug.totalStock += item.quantity;
        drug.batchCount += 1;
      }
    });

    return Array.from(drugMap.values()).sort((a, b) => 
      a.genericName.localeCompare(b.genericName)
    );
  })();

  const selectedDrug = drugs.find(d => d.key === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedDrug ? (
            <span className="flex flex-col items-start">
              <span className="font-medium">{selectedDrug.genericName} ({selectedDrug.brandName})</span>
              <span className="text-xs text-gray-500">
                {selectedDrug.strength} | Stock: {selectedDrug.totalStock} | {selectedDrug.batchCount} batch(es)
              </span>
            </span>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-0">
        <Command>
          <CommandInput placeholder="Search drugs..." />
          <CommandList>
            <CommandEmpty>No drug found.</CommandEmpty>
            <CommandGroup>
              {drugs.map((drug) => (
                <CommandItem
                  key={drug.key}
                  value={`${drug.genericName} ${drug.brandName} ${drug.strength}`}
                  onSelect={() => {
                    onSelect(drug.key, {
                      genericName: drug.genericName,
                      brandName: drug.brandName,
                      strength: drug.strength
                    });
                    setOpen(false);
                  }}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${
                      value === drug.key ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                  <div className="flex flex-col flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{drug.genericName} ({drug.brandName})</span>
                      <span className="text-xs text-gray-500">{drug.strength}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Total Stock: {drug.totalStock} | {drug.batchCount} batch(es) | {drug.drugClass}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

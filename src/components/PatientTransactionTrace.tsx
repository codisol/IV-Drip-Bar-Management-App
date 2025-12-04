import { useState } from "react";
import { formatDate as formatDateUtil } from "../utils/dateFormatter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { PatientCombobox } from "./PatientCombobox";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import {
  Search,
  FileText,
  CalendarIcon,
  ClipboardList,
  FileCheck,
  FileMinus,
  Heart,
  FileSpreadsheet,
  Send,
  Pill,
  Clock,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Filter,
  X
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "./ui/utils";
import type {
  Patient,
  Transaction,
  SoapNote,
  InventoryItem,
  InventoryTransaction,
  InformedConsent,
  DeclinationLetter,
  SickLeave,
  ReferralLetter,
  Prescription,
  FitnessCertificate,
  TriageEntry
} from "../types";

// Local document type union used only in this component
type DocumentType =
  | "informed_consent"
  | "declination_letter"
  | "sick_leave"
  | "referral_letter"
  | "prescription"
  | "fitness_certificate";

interface BaseDocument {
  id: string;
  type: DocumentType;
  transactionId?: string;
  createdAt?: string;
  date?: string;
  issueDate?: string;
  [key: string]: any;
}

interface TraceResult {
  transaction: Transaction;
  soapNote?: SoapNote | undefined;
  documents: { type: DocumentType; id: string; createdAt: string }[];
  triageEntry?: TriageEntry | null;
  expanded: boolean;
}

import { formatDateTime } from "../utils/dateFormatter";

// Small helper to format ISO date/time strings used in this component
const formatDate = (dateString?: string) => {
  if (!dateString) return "—";
  return formatDateTime(dateString);
};
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";

interface PatientTransactionTraceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigateToSection?: (section: string, filterId?: string) => void;
  patients: Patient[];
  transactions: Transaction[];
  soapNotes: SoapNote[];
  inventory: InventoryItem[];
  inventoryTransactions: InventoryTransaction[];
  informedConsents: InformedConsent[];
  declinationLetters: DeclinationLetter[];
  sickLeaves: SickLeave[];
  referralLetters: ReferralLetter[];
  prescriptions: Prescription[];
  fitnessCertificates: FitnessCertificate[];
  triageQueue: TriageEntry[];
}

export function PatientTransactionTrace({
  open,
  onOpenChange,
  onNavigateToSection,
  patients,
  transactions,
  soapNotes,
  inventory,
  inventoryTransactions,
  informedConsents,
  declinationLetters,
  sickLeaves,
  referralLetters,
  prescriptions,
  fitnessCertificates,
  triageQueue
}: PatientTransactionTraceProps) {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [results, setResults] = useState<TraceResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "soap" | DocumentType>("all");

  const handleSearch = () => {
    if (!selectedPatient) return;

    setIsSearching(true);

    // Get all transactions for the patient
    const patientTransactions = transactions.filter(
      (t) => t.patientId === selectedPatient.id
    );

    // Filter by date range if specified
    let filteredTransactions = patientTransactions;
    if (dateRange.from || dateRange.to) {
      filteredTransactions = patientTransactions.filter((t) => {
        const transactionDate = new Date(t.time);
        if (dateRange.from && dateRange.to) {
          return transactionDate >= dateRange.from && transactionDate <= dateRange.to;
        } else if (dateRange.from) {
          return transactionDate >= dateRange.from;
        } else if (dateRange.to) {
          return transactionDate <= dateRange.to;
        }
        return true;
      });
    }

    // Combine all documents into a single array with type info
    const allDocuments: BaseDocument[] = [
      ...informedConsents.map(d => ({ ...d, type: "informed_consent" as DocumentType })),
      ...declinationLetters.map(d => ({ ...d, type: "declination_letter" as DocumentType })),
      ...sickLeaves.map(d => ({ ...d, type: "sick_leave" as DocumentType })),
      ...referralLetters.map(d => ({ ...d, type: "referral_letter" as DocumentType })),
      ...prescriptions.map(d => ({ ...d, type: "prescription" as DocumentType })),
      ...fitnessCertificates.map(d => ({ ...d, type: "fitness_certificate" as DocumentType }))
    ];

    // Build trace results
    const traceResults: TraceResult[] = filteredTransactions.map((transaction) => {
      // Find associated SOAP note
      const soapNote = soapNotes.find((s) => s.transactionId === transaction.id);

      // Find associated documents
      const documents = allDocuments
        .filter((doc) => doc.transactionId === transaction.id)
        .map((doc) => ({
          type: doc.type,
          id: doc.id,
          createdAt: doc.createdAt || doc.date || doc.issueDate || "",
        }));

      // Find associated triage entry
      // Logic: 
      // 1. Explicit link (triage.transactionId === transaction.id)
      // 2. Or, closest waiting triage before transaction time
      // 3. Or, closest triage of any status before transaction time
      let triageEntry: TriageEntry | undefined = triageQueue.find(t => t.transactionId === transaction.id);

      if (!triageEntry) {
        const txTime = new Date(transaction.time).getTime();

        // Candidates: same patient, created before transaction
        const candidates = triageQueue
          .filter(t => t.patientId === transaction.patientId)
          .filter(t => {
            try {
              return new Date(t.arrivalTime).getTime() <= txTime;
            } catch {
              return false;
            }
          })
          .sort((a, b) => new Date(b.arrivalTime).getTime() - new Date(a.arrivalTime).getTime());

        // Prefer "Waiting" status if available close to the time
        const waitingCandidate = candidates.find(t => t.status === 'Waiting');
        triageEntry = waitingCandidate || candidates[0];
      }

      return {
        transaction,
        soapNote,
        documents,
        triageEntry: triageEntry || null,
        expanded: false,
      };
    });

    // Sort results by transaction time - latest first
    traceResults.sort((a, b) => {
      const dateA = new Date(a.transaction.time).getTime();
      const dateB = new Date(b.transaction.time).getTime();
      return dateB - dateA; // Descending order (latest first)
    });

    setResults(traceResults);
    setIsSearching(false);
  };

  const handleSetAllTime = () => {
    setDateRange({});
  };

  const toggleExpand = (index: number) => {
    setResults((prev: TraceResult[]) =>
      prev.map((r: TraceResult, i: number) => (i === index ? { ...r, expanded: !r.expanded } : r))
    );
  };

  const getFilteredResults = () => {
    if (activeFilter === "all") return results;
    if (activeFilter === "soap") {
      return results.filter((r: TraceResult) => r.soapNote);
    }
    return results.filter((r: TraceResult) => r.documents.some((d) => d.type === (activeFilter as DocumentType)));
  };

  const filteredResults = getFilteredResults() as TraceResult[];

  const documentTypeInfo: Record<
    DocumentType,
    { icon: any; label: string; color: string }
  > = {
    informed_consent: { icon: FileCheck, label: "Informed Consent", color: "text-teal" },
    declination_letter: { icon: FileMinus, label: "Declination Letter", color: "text-orange" },
    sick_leave: { icon: Heart, label: "Sick Leave", color: "text-green" },
    referral_letter: { icon: Send, label: "Referral Letter", color: "text-lavender" },
    prescription: { icon: Pill, label: "Prescription", color: "text-peach" },
    fitness_certificate: { icon: FileSpreadsheet, label: "Fitness Certificate", color: "text-teal" },
  };

  const getDocumentCounts = () => {
    const counts: Record<string, number> = {
      informed_consent: 0,
      declination_letter: 0,
      sick_leave: 0,
      referral_letter: 0,
      prescription: 0,
      fitness_certificate: 0,
      soap: 0,
    };

    results.forEach((r: TraceResult) => {
      if (r.soapNote) counts.soap++;
      r.documents.forEach((d) => {
        counts[d.type] = (counts[d.type] || 0) + 1;
      });
    });

    return counts;
  };

  const counts = getDocumentCounts();

  // Helper to render triage vitals (moved from render loop)
  const renderTriageVitals = (triage: TriageEntry | null | undefined) => {
    if (!triage) return null;

    const v = triage.vitals || {};
    return (
      <div className="p-3 rounded-lg bg-slate-50 border border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-600" />
            <span className="text-sm">Triage Vitals</span>
          </div>
          <span className="text-xs text-muted-foreground">Added {formatDate(triage.arrivalTime)}</span>
        </div>
        <div className="text-sm text-muted-foreground grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>BP: {v.bloodPressure ?? '—'}</div>
          <div>HR: {v.heartRate ?? '—'}</div>
          <div>Temp: {v.temperature ?? '—'}</div>
          <div>SpO₂: {v.oxygenSaturation ?? '—'}</div>
        </div>
      </div>
    );
  };



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] overflow-hidden flex flex-col gap-0 p-0">
        <DialogHeader className="p-6 pb-4 bg-gradient-ocean rounded-t-xl flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-teal">
            <Search className="h-5 w-5" />
            Patient Transaction Trace
          </DialogTitle>
          <DialogDescription>
            Search and trace all transactions, SOAP notes, and documents for a patient within a specific period
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {/* Search Section */}
          <div className="p-6 space-y-4 bg-white border-b-2 border-primary/10 flex-shrink-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Patient Selection */}
              <div className="space-y-2">
                <Label htmlFor="patient-trace" className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-teal" />
                  Patient
                </Label>
                <PatientCombobox
                  value={selectedPatient?.id || ""}
                  onValueChange={(patientId) => {
                    const patient = patients.find(p => p.id === patientId);
                    setSelectedPatient(patient || null);
                  }}
                  patients={patients}
                />
              </div>

              {/* Date Range */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-lavender" />
                  Period
                </Label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "flex-1 justify-start text-left",
                          !dateRange.from && !dateRange.to && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange.from ? (
                          dateRange.to ? (
                            <>
                              {formatDateUtil(dateRange.from)} -{" "}
                              {formatDateUtil(dateRange.to)}
                            </>
                          ) : (
                            formatDateUtil(dateRange.from)
                          )
                        ) : (
                          <span>Searching for All period</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange.from}
                        selected={dateRange as any}
                        onSelect={(range: any) => setDateRange(range || {})}
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
                  {(dateRange.from || dateRange.to) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDateRange({})}
                      className="shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSetAllTime}
                  className="w-full"
                >
                  All Time
                </Button>
              </div>
            </div>

            {/* Search Button */}
            <Button
              onClick={handleSearch}
              disabled={!selectedPatient || isSearching}
              className="w-full"
            >
              <Search className="mr-2 h-4 w-4" />
              {isSearching ? "Searching..." : "Search Transactions"}
            </Button>
          </div>

          {/* Results Section */}
          {results.length > 0 && (
            <>
              {/* Filter Tabs */}
              <div className="p-4 bg-gradient-peach border-b-2 border-primary/10 flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <Filter className="h-4 w-4 text-peach" />
                  <span className="text-sm">Filter by Type:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={activeFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveFilter("all")}
                    className="gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    All ({results.length})
                  </Button>
                  <Button
                    variant={activeFilter === "soap" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveFilter("soap")}
                    className="gap-2"
                  >
                    <ClipboardList className="h-4 w-4" />
                    SOAP Notes ({counts.soap})
                  </Button>
                  {(Object.keys(documentTypeInfo) as DocumentType[]).map((type) => {
                    const info = documentTypeInfo[type];
                    const Icon = info.icon;
                    return (
                      <Button
                        key={type}
                        variant={activeFilter === type ? "default" : "outline"}
                        size="sm"
                        onClick={() => setActiveFilter(type)}
                        className="gap-2"
                      >
                        <Icon className="h-4 w-4" />
                        {info.label} ({counts[type]})
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Results List */}
              <div className="flex-1 min-h-0 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-6 space-y-3">
                    {filteredResults.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p>No results found for this filter</p>
                      </div>
                    ) : (
                      filteredResults.map((result: TraceResult, index: number) => (
                        <Card key={result.transaction.id} className="overflow-hidden">
                          <Collapsible
                            open={result.expanded}
                            onOpenChange={() => toggleExpand(results.indexOf(result))}
                          >
                            <CardHeader className="pb-3 cursor-pointer bg-gradient-soft">
                              <CollapsibleTrigger asChild>
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <CardTitle className="flex items-center gap-2 mb-2">
                                      <FileText className="h-4 w-4 text-primary" />
                                      Transaction #{result.transaction.id.slice(0, 8)}
                                      {result.expanded ? (
                                        <ChevronUp className="h-4 w-4 ml-auto" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4 ml-auto" />
                                      )}
                                    </CardTitle>
                                    <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                                      <div className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {formatDate(result.transaction.time)}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <DollarSign className="h-3 w-3" />
                                        Rp {result.transaction.totalPayment.toLocaleString('id-ID')}
                                      </div>
                                      <Badge
                                        variant={
                                          result.transaction.status === "Paid"
                                            ? "default"
                                            : "secondary"
                                        }
                                      >
                                        {result.transaction.status}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                              </CollapsibleTrigger>
                            </CardHeader>

                            <CollapsibleContent>
                              <CardContent className="pt-4 space-y-3">
                                {/* SOAP Note */}
                                {result.soapNote && (
                                  <div className="p-3 rounded-lg bg-teal-soft border border-teal">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <ClipboardList className="h-4 w-4 text-teal" />
                                        <span className="text-sm">SOAP Note</span>
                                      </div>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onNavigateToSection?.("soap", result.soapNote?.id)}
                                      >
                                        View
                                      </Button>
                                    </div>
                                    <div className="text-xs text-muted-foreground space-y-1">
                                      <p>
                                        <strong>Subjective:</strong>{" "}
                                        {result.soapNote.subjective?.substring(0, 100) || "N/A"}...
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {/* Documents (show if documents exist OR a matching triage exists) */}
                                {(() => {
                                  const triage = result.triageEntry;
                                  if (!triage && result.documents.length === 0) return null;
                                  return (
                                    <div className="space-y-2">
                                      <Separator />
                                      <p className="text-sm">Documents:</p>
                                      <div className="grid grid-cols-1 gap-2">
                                        {/* Render triage as its own document card inside the Documents grid */}
                                        {(() => {
                                          const triage = result.triageEntry;
                                          if (!triage) return null;
                                          return (
                                            <div key={`triage-${triage.id}`} className="flex items-center justify-between p-2 rounded-lg bg-amber-50 border border-amber-200">
                                              <div className="flex items-center gap-2">
                                                <Clock className="h-4 w-4 text-amber-700" />
                                                <div>
                                                  <p className="text-sm">Triage Vitals</p>
                                                  <p className="text-xs text-muted-foreground">Added {formatDate(triage.arrivalTime)}</p>
                                                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                                    <div><strong>BP:</strong> {triage.vitals?.bloodPressure ?? '—'}</div>
                                                    <div><strong>HR:</strong> {triage.vitals?.heartRate ?? '—'}</div>
                                                    <div><strong>Temp:</strong> {triage.vitals?.temperature ?? '—'}</div>
                                                    <div><strong>SpO₂:</strong> {triage.vitals?.oxygenSaturation ?? '—'}</div>
                                                  </div>
                                                </div>
                                              </div>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => onNavigateToSection?.('triage', triage.id)}
                                              >
                                                View
                                              </Button>
                                            </div>
                                          );
                                        })()}

                                        {result.documents.map((doc: { type: DocumentType; id: string; createdAt: string }) => {
                                          const info = documentTypeInfo[doc.type];
                                          const Icon = info.icon;
                                          return (
                                            <div
                                              key={doc.id}
                                              className="flex items-center justify-between p-2 rounded-lg bg-green-soft border border-green"
                                            >
                                              <div className="flex items-center gap-2">
                                                <Icon className={cn("h-4 w-4", info.color)} />
                                                <div>
                                                  <p className="text-sm">{info.label}</p>
                                                  <p className="text-xs text-muted-foreground">
                                                    {formatDate(doc.createdAt)}
                                                  </p>
                                                </div>
                                              </div>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                  onNavigateToSection?.(
                                                    "documents",
                                                    `${doc.type}:${doc.id}`
                                                  )
                                                }
                                              >
                                                View
                                              </Button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })()}

                                {/* Drugs Used */}
                                {result.transaction.drugsUsed &&
                                  result.transaction.drugsUsed.length > 0 && (
                                    <div className="space-y-2">
                                      <Separator />
                                      <div className="flex items-center justify-between mb-1">
                                        <p className="text-sm">Drugs Used ({result.transaction.drugsUsed.length}):</p>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => onNavigateToSection?.("inventory", result.transaction.id)}
                                          className="gap-1 h-7 text-xs"
                                        >
                                          <Pill className="h-3 w-3" />
                                          View in Stock Movement
                                        </Button>
                                      </div>
                                      <div className="space-y-2">
                                        {result.transaction.drugsUsed.map((drug: any, idx: number) => {
                                          const item = inventory.find(
                                            (i) => i.id === drug.drugId && i.batchNumber === drug.batchNumber
                                          );
                                          return (
                                            <div
                                              key={idx}
                                              className="p-3 rounded-lg bg-lavender-soft border border-lavender"
                                            >
                                              <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 space-y-1">
                                                  <div className="flex items-center gap-2">
                                                    <p className="font-medium">{drug.drugName}</p>
                                                    <Badge variant="secondary" className="text-xs">
                                                      Qty: {drug.quantity}
                                                    </Badge>
                                                  </div>
                                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                                    <div>
                                                      <span className="opacity-70">Brand:</span> {item?.brandName || "N/A"}
                                                    </div>
                                                    <div>
                                                      <span className="opacity-70">Strength:</span> {item?.strength || "N/A"}
                                                    </div>
                                                    <div>
                                                      <span className="opacity-70">Batch:</span> {drug.batchNumber}
                                                    </div>
                                                    <div>
                                                      <span className="opacity-70">Exp:</span> {item?.expiryDate ? formatDateUtil(item.expiryDate) : "N/A"}
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                              </CardContent>
                            </CollapsibleContent>
                          </Collapsible>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </>
          )}

          {/* Empty State */}
          {results.length === 0 && !isSearching && (
            <div className="flex-1 min-h-0 flex items-center justify-center p-8 text-center text-muted-foreground">
              <div>
                <Search className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg mb-2">No search performed yet</p>
                <p className="text-sm">
                  Select a patient and date range, then click "Search Transactions" to view their history
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from 'react';
import { TriageEntry, Patient, Transaction } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { PatientCombobox } from './PatientCombobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ClipboardPlus, Clock, User, AlertCircle, CheckCircle2, Play, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from './ui/alert';

interface TriageProps {
  triageQueue: TriageEntry[];
  patients: Patient[];
  onAddTriage: (triage: TriageEntry) => void;
  onUpdateTriage: (id: string, updates: Partial<TriageEntry>) => void;
  onQuickRegisterPatient: (patient: Patient) => void;
  onCreateTransaction?: (transaction: Transaction) => void;
}

export function Triage({ triageQueue, patients, onAddTriage, onUpdateTriage, onQuickRegisterPatient, onCreateTransaction }: TriageProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [isQuickRegister, setIsQuickRegister] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [triageLevel, setTriageLevel] = useState<'Priority' | 'Standard' | 'Wellness'>('Standard');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [notes, setNotes] = useState('');
  const [vitals, setVitals] = useState({
    bloodPressure: '',
    heartRate: '',
    temperature: '',
    oxygenSaturation: '',
  });
  const [filterStatus, setFilterStatus] = useState<'All' | 'Waiting' | 'In Progress' | 'Completed'>('All');
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Force refresh every minute to update waiting times
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, 60000); // 60 seconds
    
    return () => clearInterval(interval);
  }, []);
  
  // Confirmation dialog states
  const [confirmAction, setConfirmAction] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {}
  });

  const resetForm = () => {
    setSelectedPatientId('');
    setIsQuickRegister(false);
    setQuickName('');
    setTriageLevel('Standard');
    setChiefComplaint('');
    setNotes('');
    setVitals({
      bloodPressure: '',
      heartRate: '',
      temperature: '',
      oxygenSaturation: '',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let patientId = selectedPatientId;
    let patientName = '';

    // Quick registration if needed
    if (isQuickRegister && quickName.trim()) {
      const quickPatient: Patient = {
        id: `quick-${quickName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
        name: quickName.trim(),
        phone: '',
        gender: 'Other',
        dob: '',
        createdAt: new Date().toISOString(),
        isQuickRegistration: true
      };
      onQuickRegisterPatient(quickPatient);
      patientId = quickPatient.id;
      patientName = quickPatient.name;
      toast.success(`Quick registered: ${quickName}. Please complete their info later.`);
    } else {
      const patient = patients.find(p => p.id === patientId);
      if (!patient) {
        toast.error('Please select a patient or use quick registration');
        return;
      }
      patientName = patient.name;
    }

    const hasVitals = vitals.bloodPressure || vitals.heartRate || vitals.temperature || vitals.oxygenSaturation;

    let newTriage: TriageEntry = {
      id: Date.now().toString(),
      patientId,
      patientName,
      level: triageLevel,
      chiefComplaint: chiefComplaint || undefined,
      arrivalTime: new Date().toISOString(),
      vitals: hasVitals ? {
        bloodPressure: vitals.bloodPressure || undefined,
        heartRate: vitals.heartRate || undefined,
        temperature: vitals.temperature || undefined,
        oxygenSaturation: vitals.oxygenSaturation || undefined,
      } : undefined,
      notes: notes || undefined,
      status: 'Waiting',
    };

    // Immediately create a transaction when adding to triage
    if (onCreateTransaction) {
      const transaction: Transaction = {
        id: `TXN-${Date.now()}`,
        patientId,
        patientName,
        time: new Date().toISOString(),
        totalPayment: 0,
        status: 'On Progress',
        drugsUsed: [],
        createdAt: new Date().toISOString()
      };
      onCreateTransaction(transaction);
      // link triage entry to the created transaction
      newTriage.transactionId = transaction.id;
      toast.success('Transaction created');
    }

    onAddTriage(newTriage);
    toast.success('Patient added to triage queue');
    resetForm();
    setIsAddDialogOpen(false);
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'Priority':
        return 'bg-red-500 hover:bg-red-600';
      case 'Standard':
        return 'bg-yellow-500 hover:bg-yellow-600';
      case 'Wellness':
        return 'bg-green-500 hover:bg-green-600';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Waiting':
        return 'bg-blue-100 text-blue-800';
      case 'In Progress':
        return 'bg-orange-100 text-orange-800';
      case 'Completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getWaitingTime = (arrivalTime: string, completedAt?: string) => {
    const arrival = new Date(arrivalTime);
    const endTime = completedAt ? new Date(completedAt) : new Date();
    const diffMs = endTime.getTime() - arrival.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins} min`;
    } else {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `${hours}h ${mins}m`;
    }
  };

  const handleStatusChange = (id: string, newStatus: 'Waiting' | 'In Progress' | 'Completed') => {
    const entry = triageQueue.find(e => e.id === id);
    if (!entry) return;
    
    const patient = patients.find(p => p.id === entry.patientId);
    let confirmTitle = '';
    let confirmDescription = '';
    
    if (newStatus === 'In Progress') {
      confirmTitle = 'Start Treatment?';
      confirmDescription = `Are you sure you want to start treatment for ${patient?.name || 'this patient'}? This will move them from the waiting queue to active treatment.`;
    } else if (newStatus === 'Completed') {
      confirmTitle = 'Complete Triage?';
      confirmDescription = `Are you sure you want to mark the triage for ${patient?.name || 'this patient'} as completed? This will remove them from the active queue.`;
    } else {
      // For "Waiting" status, no confirmation needed
      const updates: Partial<TriageEntry> = { status: newStatus };
      onUpdateTriage(id, updates);
      toast.success(`Status updated to ${newStatus}`);
      return;
    }
    
    setConfirmAction({
      open: true,
      title: confirmTitle,
      description: confirmDescription,
      onConfirm: () => {
        const updates: Partial<TriageEntry> = { status: newStatus };
        if (newStatus === 'Completed') {
          updates.completedAt = new Date().toISOString();
        }
        onUpdateTriage(id, updates);
        toast.success(`Status updated to ${newStatus}`);
        setConfirmAction({ ...confirmAction, open: false });
      }
    });
  };

  const filteredQueue = triageQueue.filter(entry => {
    if (filterStatus === 'All') return true;
    return entry.status === filterStatus;
  }).sort((a, b) => {
    // Sort by: 1) Status (Waiting first), 2) Priority level, 3) Arrival time
    const statusOrder = { 'Waiting': 0, 'In Progress': 1, 'Completed': 2 };
    const levelOrder = { 'Priority': 0, 'Standard': 1, 'Wellness': 2 };
    
    if (a.status !== b.status) {
      return statusOrder[a.status] - statusOrder[b.status];
    }
    if (a.level !== b.level) {
      return levelOrder[a.level] - levelOrder[b.level];
    }
    return new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime();
  });

  const stats = {
    waiting: triageQueue.filter(t => t.status === 'Waiting').length,
    inProgress: triageQueue.filter(t => t.status === 'In Progress').length,
    priority: triageQueue.filter(t => t.level === 'Priority' && t.status !== 'Completed').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2>Triage Queue</h2>
          <p className="text-gray-600">Manage patient flow and prioritization</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <ClipboardPlus className="w-4 h-4 mr-2" />
              Add to Triage
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Patient to Triage</DialogTitle>
              <DialogDescription>Register patient arrival and assign triage level</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Emergency Quick Register:</strong> For urgent cases, toggle quick register to create a patient with just their name. Complete their details later in the Patients tab.
                </AlertDescription>
              </Alert>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={isQuickRegister ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setIsQuickRegister(!isQuickRegister);
                    if (!isQuickRegister) {
                      setSelectedPatientId('');
                    }
                  }}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Quick Register
                </Button>
                <span className="text-sm text-gray-600">
                  {isQuickRegister ? 'Name only - complete info later' : 'Select from existing patients'}
                </span>
              </div>

              {isQuickRegister ? (
                <div className="space-y-2">
                  <Label htmlFor="quickName">Patient Name *</Label>
                  <Input
                    id="quickName"
                    value={quickName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuickName(e.target.value)}
                    placeholder="Enter patient name"
                    required
                    autoFocus
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Select Patient *</Label>
                  <PatientCombobox
                    patients={patients}
                    value={selectedPatientId}
                    onValueChange={setSelectedPatientId}
                    placeholder="Search patient..."
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Triage Level *</Label>
                <Select value={triageLevel} onValueChange={(val: string) => setTriageLevel(val as 'Priority' | 'Standard' | 'Wellness')} required>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Priority">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        Priority - Urgent attention needed
                      </div>
                    </SelectItem>
                    <SelectItem value="Standard">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        Standard - Regular treatment
                      </div>
                    </SelectItem>
                    <SelectItem value="Wellness">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        Wellness - Routine/preventive care
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="complaint">Chief Complaint (Optional)</Label>
                <Input
                  id="complaint"
                  value={chiefComplaint}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setChiefComplaint(e.target.value)}
                  placeholder="Brief description of symptoms or reason for visit"
                />
              </div>

              <div className="space-y-2">
                <Label>Vital Signs (Optional)</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Input
                      placeholder="BP (e.g., 120/80)"
                      value={vitals.bloodPressure}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVitals({ ...vitals, bloodPressure: e.target.value })}
                    />
                  </div>
                  <div>
                    <Input
                      placeholder="HR (e.g., 72 bpm)"
                      value={vitals.heartRate}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVitals({ ...vitals, heartRate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Input
                      placeholder="Temp (e.g., 36.5°C)"
                      value={vitals.temperature}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVitals({ ...vitals, temperature: e.target.value })}
                    />
                  </div>
                  <div>
                    <Input
                      placeholder="SpO₂ (e.g., 98%)"
                      value={vitals.oxygenSaturation}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVitals({ ...vitals, oxygenSaturation: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                  placeholder="Additional notes or observations"
                  rows={2}
                />
              </div>

              <Button type="submit" className="w-full">Add to Triage Queue</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              Waiting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl">{stats.waiting}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Play className="w-4 h-4 text-orange-500" />
              In Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              Priority Patients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl">{stats.priority}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <Button
          variant={filterStatus === 'All' ? 'default' : 'outline'}
          onClick={() => setFilterStatus('All')}
          size="sm"
        >
          All
        </Button>
        <Button
          variant={filterStatus === 'Waiting' ? 'default' : 'outline'}
          onClick={() => setFilterStatus('Waiting')}
          size="sm"
        >
          Waiting
        </Button>
        <Button
          variant={filterStatus === 'In Progress' ? 'default' : 'outline'}
          onClick={() => setFilterStatus('In Progress')}
          size="sm"
        >
          In Progress
        </Button>
        <Button
          variant={filterStatus === 'Completed' ? 'default' : 'outline'}
          onClick={() => setFilterStatus('Completed')}
          size="sm"
        >
          Completed
        </Button>
      </div>

      {/* Queue Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Level</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Chief Complaint</TableHead>
              <TableHead>Vitals</TableHead>
              <TableHead>Waiting Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredQueue.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                  No patients in triage queue
                </TableCell>
              </TableRow>
            ) : (
              filteredQueue.map((entry) => (
                <TableRow key={`${entry.id}-${refreshKey}`}>
                  <TableCell>
                    <Badge className={getLevelColor(entry.level)}>
                      {entry.level}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      {entry.patientName}
                    </div>
                  </TableCell>
                  <TableCell>
                    {entry.chiefComplaint || <span className="text-gray-400">-</span>}
                  </TableCell>
                  <TableCell>
                    {entry.vitals ? (
                      <div className="text-sm space-y-1">
                        {entry.vitals.bloodPressure && <div>BP: {entry.vitals.bloodPressure}</div>}
                        {entry.vitals.heartRate && <div>HR: {entry.vitals.heartRate}</div>}
                        {entry.vitals.temperature && <div>Temp: {entry.vitals.temperature}</div>}
                        {entry.vitals.oxygenSaturation && <div>SpO₂: {entry.vitals.oxygenSaturation}</div>}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Clock className="w-3 h-3" />
                      {getWaitingTime(entry.arrivalTime, entry.completedAt)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusColor(entry.status)}>
                      {entry.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {entry.status === 'Waiting' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(entry.id, 'In Progress')}
                        >
                          Start
                        </Button>
                      )}
                      {entry.status === 'In Progress' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(entry.id, 'Completed')}
                        >
                          Complete
                        </Button>
                      )}
                      {entry.status === 'Completed' && (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Confirmation Dialog */}
  <AlertDialog open={confirmAction.open} onOpenChange={(open: boolean) => setConfirmAction({ ...confirmAction, open })}>
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
    </div>
  );
}

import { useState } from 'react';
import { DoctorProfile as DoctorProfileType } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Textarea } from './ui/textarea';
import { UserCircle, Building2, MapPin, FileText, Stethoscope, Phone, Mail } from 'lucide-react';
import { toast } from 'sonner';

interface DoctorProfileProps {
  profile?: DoctorProfileType;
  onSaveProfile: (profile: DoctorProfileType) => void;
}

export function DoctorProfile({ profile, onSaveProfile }: DoctorProfileProps) {
  const [formData, setFormData] = useState<DoctorProfileType>(
    profile || {
      doctorName: '',
      clinicName: '',
      clinicAddress: '',
      permitCode: '',
      specialization: '',
      phoneNumber: '',
      email: ''
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.doctorName || !formData.clinicName || !formData.clinicAddress || !formData.permitCode) {
      toast.error('Please fill in all required fields');
      return;
    }

    onSaveProfile(formData);
    toast.success('Doctor profile saved successfully');
  };

  const handleChange = (field: keyof DoctorProfileType, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle className="w-6 h-6" />
            Doctor & Clinic Profile
          </CardTitle>
          <CardDescription>
            Register your professional details. This information will be automatically included in all medical documents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Doctor Information */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Stethoscope className="w-5 h-5" />
                Doctor Information
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="doctorName">
                    Doctor Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="doctorName"
                    value={formData.doctorName}
                    onChange={(e) => handleChange('doctorName', e.target.value)}
                    placeholder="Dr. John Doe"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="permitCode">
                    Permit Code / License Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="permitCode"
                    value={formData.permitCode}
                    onChange={(e) => handleChange('permitCode', e.target.value)}
                    placeholder="MD-12345"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialization">Specialization</Label>
                  <Input
                    id="specialization"
                    value={formData.specialization || ''}
                    onChange={(e) => handleChange('specialization', e.target.value)}
                    placeholder="General Practice, Internal Medicine, etc."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="doctor@clinic.com"
                  />
                </div>
              </div>
            </div>

            {/* Clinic Information */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-medium flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Clinic Information
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="clinicName">
                    Clinic Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="clinicName"
                    value={formData.clinicName}
                    onChange={(e) => handleChange('clinicName', e.target.value)}
                    placeholder="City Medical Center"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clinicAddress" className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    Clinic Address <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="clinicAddress"
                    value={formData.clinicAddress}
                    onChange={(e) => handleChange('clinicAddress', e.target.value)}
                    placeholder="123 Main Street, Suite 100&#10;City, State, ZIP Code"
                    rows={3}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber" className="flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    Clinic Phone Number
                  </Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    value={formData.phoneNumber || ''}
                    onChange={(e) => handleChange('phoneNumber', e.target.value)}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button type="submit" className="w-full md:w-auto">
                <FileText className="w-4 h-4 mr-2" />
                Save Profile
              </Button>
            </div>
          </form>

          {profile && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                ✓ Profile configured. All medical documents will automatically include your professional details.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export interface Golfer {
  id: string;
  fullName: string;
  company: string;
  mailingAddress: string;
  phone: string;
  mobile?: string;
  email: string;
  paymentOption: 'pay-now' | 'pay-on-day';
  paymentStatus: 'paid' | 'unpaid';
  registrationStatus: 'confirmed' | 'waitlist';
  checkedIn: boolean;
  groupNumber?: number;
  groupPosition?: string;
  holeAssignment?: number;
  createdAt: string;
}

export interface Group {
  id: string;
  number: number;
  holeAssignment?: number;
  players: Golfer[];
}

export interface CheckInPayment {
  method: 'cash' | 'check' | 'credit';
  receiptNumber: string;
  notes?: string;
}

export interface AdminSettings {
  stripePublicKey: string;
  stripeSecretKey: string;
  adminEmail: string;
  capacityLimit: number;
}

export interface RegistrationFormData {
  fullName: string;
  company: string;
  mailingAddress: string;
  phone: string;
  mobile?: string;
  email: string;
  paymentOption: 'pay-now' | 'pay-on-day';
  waiverAccepted: boolean;
}

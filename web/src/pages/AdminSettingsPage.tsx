import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../components/AdminLayout';
import { Card, Button, Input } from '../components/ui';
import { Save, Settings as SettingsIcon, RefreshCw, UserPlus, Trash2, Users, CheckCircle, Clock, Calendar, ExternalLink, Check, X, AlertTriangle } from 'lucide-react';
import { api, Settings, Admin } from '../services/api';
import { useTournament } from '../contexts';
import toast from 'react-hot-toast';

export const AdminSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentTournament, refreshTournaments } = useTournament();
  
  const [settings, setSettings] = useState<Partial<Settings>>({
    stripe_public_key: '',
    stripe_secret_key: '',
    stripe_webhook_secret: '',
    payment_mode: 'test',
    admin_email: '',
  });
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [currentAdmin, setCurrentAdmin] = useState<Admin | null>(null);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);
  const [deletingAdminId, setDeletingAdminId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [settingsData, adminsData, meData] = await Promise.all([
        api.getSettings(),
        api.getAdmins(),
        api.getCurrentAdmin(),
      ]);
      setSettings({
        stripe_public_key: settingsData.stripe_public_key || '',
        stripe_secret_key: settingsData.stripe_secret_key || '',
        stripe_webhook_secret: settingsData.stripe_webhook_secret || '',
        payment_mode: settingsData.payment_mode || 'test',
        admin_email: settingsData.admin_email || '',
      });
      setAdmins(adminsData);
      setCurrentAdmin(meData);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim()) return;

    setIsAddingAdmin(true);
    try {
      await api.createAdmin({ email: newAdminEmail.trim() });
      toast.success(`Admin invite sent to ${newAdminEmail}`);
      setNewAdminEmail('');
      const adminsData = await api.getAdmins();
      setAdmins(adminsData);
    } catch (err) {
      console.error('Error adding admin:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to add admin');
    } finally {
      setIsAddingAdmin(false);
    }
  };

  const handleDeleteAdmin = async (adminId: number) => {
    setDeletingAdminId(adminId);
    try {
      await api.deleteAdmin(adminId);
      toast.success('Admin removed');
      setAdmins(admins.filter(a => a.id !== adminId));
    } catch (err) {
      console.error('Error removing admin:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to remove admin');
    } finally {
      setDeletingAdminId(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage('');
    setError(null);

    try {
      await api.updateSettings(settings);
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setSaveMessage('Error saving settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleRegistration = async () => {
    if (!currentTournament) return;
    
    try {
      if (currentTournament.registration_open) {
        await api.updateTournament(currentTournament.id, { registration_open: false });
        toast.success('Registration closed');
      } else {
        await api.updateTournament(currentTournament.id, { registration_open: true });
        toast.success('Registration opened');
      }
      refreshTournaments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update registration status');
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-2 text-gray-600">
            <RefreshCw className="animate-spin" size={24} />
            <span>Loading settings...</span>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-4 lg:space-y-6">
        <div className="flex items-center gap-2 lg:gap-3">
          <SettingsIcon className="text-brand-800" size={28} />
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Settings</h1>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 lg:px-4 py-2 lg:py-3 rounded-lg text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">×</button>
          </div>
        )}

        {/* Current Tournament Quick Info */}
        {currentTournament && (
          <Card className={`p-4 lg:p-6 border-2 ${currentTournament.registration_open ? 'border-green-500' : 'border-red-500'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg lg:text-xl font-bold text-gray-900 mb-1">
                  Current Tournament
                </h2>
                <p className="text-sm text-gray-600">
                  {currentTournament.display_name}
                </p>
                <div className="flex items-center gap-4 mt-2 text-sm flex-wrap">
                  <span className="text-gray-600">
                    {currentTournament.confirmed_count}/{currentTournament.max_capacity} registered
                    {currentTournament.reserved_slots > 0 && (
                      <span className="text-amber-600 ml-1">({currentTournament.reserved_slots} reserved)</span>
                    )}
                  </span>
                  <span className="text-gray-600">
                    ${currentTournament.entry_fee_dollars} fee
                  </span>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handleToggleRegistration}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    currentTournament.registration_open 
                      ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {currentTournament.registration_open ? 'Close Registration' : 'Open Registration'}
                </button>
                
                <Button
                  variant="outline"
                  onClick={() => navigate('/admin/tournaments')}
                >
                  <Calendar size={16} className="mr-2" />
                  Manage Tournament
                </Button>
              </div>
            </div>
            
            <div className={`mt-4 p-3 rounded-lg ${currentTournament.registration_open ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className={`text-sm font-medium flex items-center gap-2 ${currentTournament.registration_open ? 'text-green-800' : 'text-red-800'}`}>
                {currentTournament.registration_open 
                  ? <><Check className="w-4 h-4" /> Registration is OPEN</> 
                  : <><X className="w-4 h-4" /> Registration is CLOSED</>}
              </p>
            </div>
          </Card>
        )}

        <form onSubmit={handleSave} className="space-y-4 lg:space-y-6">
          {/* Payment Mode Toggle */}
          <Card className="p-4 lg:p-6">
            <h2 className="text-lg lg:text-xl font-bold text-gray-900 mb-2 lg:mb-4">
              Payment Mode
            </h2>
            <p className="text-xs lg:text-sm text-gray-600 mb-4">
              Control how payments are processed for new registrations.
            </p>

            <div className="space-y-3">
              <label 
                className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  settings.payment_mode === 'test' 
                    ? 'border-amber-500 bg-amber-50' 
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="payment_mode"
                  value="test"
                  checked={settings.payment_mode === 'test'}
                  onChange={handleChange}
                  className="mt-0.5 w-4 h-4 text-amber-600"
                />
                <div>
                  <p className="font-semibold text-gray-900">Test Mode (Simulated)</p>
                  <p className="text-xs lg:text-sm text-gray-600">
                    Payments are simulated - no real charges. Perfect for testing and demos.
                    No Stripe configuration required.
                  </p>
                </div>
              </label>

              <label 
                className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  settings.payment_mode === 'production' 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="payment_mode"
                  value="production"
                  checked={settings.payment_mode === 'production'}
                  onChange={handleChange}
                  className="mt-0.5 w-4 h-4 text-green-600"
                />
                <div>
                  <p className="font-semibold text-gray-900">Production (Real Payments)</p>
                  <p className="text-xs lg:text-sm text-gray-600">
                    Real Stripe checkout - actual payments will be processed.
                    Requires Stripe API keys below.
                  </p>
                </div>
              </label>
            </div>

            {settings.payment_mode === 'test' && (
              <div className="mt-4 bg-amber-100 border border-amber-300 rounded-lg p-3 lg:p-4">
                <p className="text-xs lg:text-sm text-amber-900 font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Test Mode Active - No real payments will be processed
                </p>
              </div>
            )}

            {settings.payment_mode === 'production' && !settings.stripe_secret_key && (
              <div className="mt-4 bg-red-100 border border-red-300 rounded-lg p-3 lg:p-4">
                <p className="text-xs lg:text-sm text-red-900 font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Production mode requires Stripe API keys. Configure them below.
                </p>
              </div>
            )}
          </Card>

          <Card className="p-4 lg:p-6">
            <h2 className="text-lg lg:text-xl font-bold text-gray-900 mb-2 lg:mb-4">
              Stripe Configuration
            </h2>
            <p className="text-xs lg:text-sm text-gray-600 mb-3 lg:mb-4">
              Configure your Stripe API keys for payment processing.
            </p>

            <div className="space-y-3 lg:space-y-4">
              <Input
                label="Stripe Publishable Key"
                name="stripe_public_key"
                value={settings.stripe_public_key || ''}
                onChange={handleChange}
                placeholder="pk_test_..."
                type="password"
              />

              <Input
                label="Stripe Secret Key"
                name="stripe_secret_key"
                value={settings.stripe_secret_key || ''}
                onChange={handleChange}
                placeholder="sk_test_..."
                type="password"
              />

              <Input
                label="Stripe Webhook Secret (Optional)"
                name="stripe_webhook_secret"
                value={settings.stripe_webhook_secret || ''}
                onChange={handleChange}
                placeholder="whsec_..."
                type="password"
              />

              <div className="bg-brand-50 border border-brand-200 rounded-lg p-3 lg:p-4">
                <p className="text-xs lg:text-sm text-brand-800">
                  <strong>Note:</strong> Find your Stripe API keys in your{' '}
                  <a
                    href="https://dashboard.stripe.com/apikeys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-brand-700"
                  >
                    Stripe Dashboard
                  </a>
                  . Use test keys for development. The webhook secret is found in{' '}
                  <a
                    href="https://dashboard.stripe.com/webhooks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-brand-700"
                  >
                    Webhooks settings
                  </a>
                  .
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 lg:p-6">
            <h2 className="text-lg lg:text-xl font-bold text-gray-900 mb-2 lg:mb-4">
              Admin Notifications
            </h2>
            <p className="text-xs lg:text-sm text-gray-600 mb-3 lg:mb-4">
              Set the email address(es) for admin notifications when new golfers register.
              Multiple emails can be separated by commas.
            </p>

            <Input
              label="Admin Notification Email(s)"
              name="admin_email"
              type="text"
              value={settings.admin_email || ''}
              onChange={handleChange}
              placeholder="admin@example.com, admin2@example.com"
            />
          </Card>

          {saveMessage && (
            <div
              className={`p-3 lg:p-4 rounded-lg text-sm ${
                saveMessage.includes('Error')
                  ? 'bg-red-50 border border-red-200 text-red-700'
                  : 'bg-green-50 border border-green-200 text-green-700'
              }`}
            >
              {saveMessage}
            </div>
          )}

          <div className="flex justify-end pb-4">
            <Button type="submit" size="lg" disabled={isSaving} className="w-full sm:w-auto">
              {isSaving ? (
                <>
                  <RefreshCw size={18} className="mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} className="mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Admin Management Section */}
        <Card className="p-4 lg:p-6">
          <div className="flex items-center gap-2 mb-2 lg:mb-4">
            <Users className="text-brand-800" size={22} />
            <h2 className="text-lg lg:text-xl font-bold text-gray-900">
              Admin Management
            </h2>
          </div>
          <p className="text-xs lg:text-sm text-gray-600 mb-4">
            Manage who has admin access. Add admins by email - they'll be linked when they first log in via Clerk.
          </p>

          {/* Add New Admin Form */}
          <form onSubmit={handleAddAdmin} className="flex gap-2 mb-4">
            <div className="flex-1">
              <input
                type="email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="Enter email to add admin..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-800 text-sm"
              />
            </div>
            <Button
              type="submit"
              disabled={isAddingAdmin || !newAdminEmail.trim()}
              className="flex-shrink-0"
            >
              {isAddingAdmin ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <>
                  <UserPlus size={16} />
                  <span className="hidden sm:inline ml-1">Add</span>
                </>
              )}
            </Button>
          </form>

          {/* Admins List */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Current Admins ({admins.length})
            </p>
            {admins.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No admins configured</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {admins.map((admin) => (
                  <div
                    key={admin.id}
                    className="flex items-center justify-between py-3 gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`p-2 rounded-full flex-shrink-0 ${
                        admin.clerk_id ? 'bg-green-100' : 'bg-amber-100'
                      }`}>
                        {admin.clerk_id ? (
                          <CheckCircle className="text-green-600" size={16} />
                        ) : (
                          <Clock className="text-amber-600" size={16} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {admin.email}
                          {currentAdmin?.id === admin.id && (
                            <span className="ml-2 text-xs text-brand-600">(You)</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          {admin.clerk_id ? (
                            <span className="text-green-600">Active</span>
                          ) : (
                            <span className="text-amber-600">Pending (hasn't logged in yet)</span>
                          )}
                          {admin.name && ` · ${admin.name}`}
                        </p>
                      </div>
                    </div>
                    {currentAdmin?.id !== admin.id && (
                      <button
                        onClick={() => handleDeleteAdmin(admin.id)}
                        disabled={deletingAdminId === admin.id}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                        title="Remove admin"
                      >
                        {deletingAdminId === admin.id ? (
                          <RefreshCw size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-brand-50 border border-brand-200 rounded-lg p-3 lg:p-4 mt-4">
            <p className="text-xs lg:text-sm text-brand-800">
              <strong>How it works:</strong> Add an email address, and when that person signs up/logs in through Clerk with that email, they'll automatically get admin access.
            </p>
          </div>
        </Card>

        {/* Tournament Settings Link */}
        <Card className="p-4 lg:p-6 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                Tournament Settings
              </h2>
              <p className="text-sm text-gray-600">
                Tournament details, capacity, entry fee, and other tournament-specific settings are now managed on the Tournaments page.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate('/admin/tournaments')}
            >
              <ExternalLink size={16} className="mr-2" />
              Go to Tournaments
            </Button>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
};

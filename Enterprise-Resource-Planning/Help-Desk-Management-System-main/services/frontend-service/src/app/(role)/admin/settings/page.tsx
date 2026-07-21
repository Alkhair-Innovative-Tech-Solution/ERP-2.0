'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../../lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/Button';
import ConfirmModal from '../../../../components/modals/ConfirmModal';
import { THEME } from '../../../../lib/theme';
import { PageContainer } from '../../../../components/layout/PageContainer';
import {
  Settings,
  Building2,
  Tag,
  Clock,
  Link2,
  Bell,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Users,
  CheckCircle,
  AlertCircle,
  Key,
  Mail,
  Smartphone,
  RefreshCw
} from 'lucide-react';

// Types
interface Department {
  id: string;
  name: string;
}
                     

interface Category {
  id: string;
  name: string;
  department: string;
  defaultPriority: 'low' | 'medium' | 'high' | 'urgent';
}

interface SLATemplate {
  id: string;
  name: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDelta: number; // days
  categoryId?: string;
  categoryName?: string;
}

interface IntegrationSettings {
  smsEnabled: boolean;
  smsApiKey: string;
  smsApiEndpoint: string;
  syncInterval: number; // minutes
  lastSync?: string;
}

interface NotificationSettings {
  emailEnabled: boolean;
  emailFrom: string;
  reminderInterval: number; // hours
  autoCloseEnabled: boolean;
  autoCloseDays: number; // default 3
}

const AdminSettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'categories' | 'sla' | 'integrations' | 'notifications'>('categories');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('departments');
    if (stored) {
      try {
        setDepartments(JSON.parse(stored));
      } catch {
        setDepartments([]);
      }
    }
  }, []);



  // Categories
  const [categories, setCategories] = useState<Category[]>([
    { id: '1', name: 'Feature Request', department: 'Development', defaultPriority: 'medium' },
    { id: '2', name: 'Bug Fix', department: 'Development', defaultPriority: 'high' },
    { id: '3', name: 'Hardware Issue', department: 'IT', defaultPriority: 'medium' },
    { id: '4', name: 'Software Issue', department: 'IT', defaultPriority: 'high' },
    { id: '5', name: 'Payment Issue', department: 'Finance & Accounts', defaultPriority: 'medium' },
    { id: '6', name: 'Purchase Request', department: 'Procurement', defaultPriority: 'medium' },
    { id: '7', name: 'Repair', department: 'Basic Maintenance', defaultPriority: 'high' },
    { id: '8', name: 'Design Request', department: 'Architecture', defaultPriority: 'medium' },
    { id: '9', name: 'Documentation', department: 'Administration', defaultPriority: 'low' },
    { id: '10', name: 'Other', department: 'Development', defaultPriority: 'medium' },
  ]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState<{
    name: string;
    department: string;
    defaultPriority: 'low' | 'medium' | 'high' | 'urgent';
  }>({ name: '', department: '', defaultPriority: 'medium' });

  // SLA Templates
  const [slaTemplates, setSlaTemplates] = useState<SLATemplate[]>([
    { id: '1', name: 'Urgent SLA', priority: 'urgent', dueDelta: 1 },
    { id: '2', name: 'High Priority SLA', priority: 'high', dueDelta: 3 },
    { id: '3', name: 'Medium Priority SLA', priority: 'medium', dueDelta: 7 },
    { id: '4', name: 'Low Priority SLA', priority: 'low', dueDelta: 14 },
  ]);
  const [showSLAModal, setShowSLAModal] = useState(false);
  const [editingSLA, setEditingSLA] = useState<SLATemplate | null>(null);
  const [slaForm, setSlaForm] = useState<{
    name: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    dueDelta: number;
    categoryId: string;
  }>({ name: '', priority: 'medium', dueDelta: 7, categoryId: '' });

  // Integrations
  const [integrationSettings, setIntegrationSettings] = useState<IntegrationSettings>({
    smsEnabled: false,
    smsApiKey: '',
    smsApiEndpoint: 'https://api.sms-provider.com',
    syncInterval: 60,
  });

  // Notifications
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    emailEnabled: true,
    emailFrom: 'noreply@helpdesk.com',
    reminderInterval: 24,
    autoCloseEnabled: true,
    autoCloseDays: 3,
  });

  // Confirm modal
  const [confirm, setConfirm] = useState<{ open: boolean; type?: string; id?: string; onConfirm?: () => void }>({ open: false });

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage('');

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    setSaving(false);
    setSaveMessage('Settings saved successfully!');
    setTimeout(() => setSaveMessage(''), 3000);
  };



  // Category handlers
  const handleAddCategory = () => {
    setEditingCategory(null);
    setCategoryForm({ name: '', department: '', defaultPriority: 'medium' });
    setShowCategoryModal(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      department: category.department,
      defaultPriority: category.defaultPriority
    });
    setShowCategoryModal(true);
  };

  const handleSaveCategory = () => {
    if (!categoryForm.name.trim() || !categoryForm.department) return;

    if (editingCategory) {
      setCategories(prev => prev.map(c =>
        c.id === editingCategory.id
          ? { ...c, ...categoryForm }
          : c
      ));
    } else {
      setCategories(prev => [...prev, {
        id: Date.now().toString(),
        ...categoryForm,
      }]);
    }
    setShowCategoryModal(false);
    setEditingCategory(null);
    setCategoryForm({ name: '', department: '', defaultPriority: 'medium' });
  };

  const handleDeleteCategory = (id: string) => {
    setConfirm({
      open: true,
      type: 'category',
      id,
      onConfirm: () => {
        setCategories(prev => prev.filter(c => c.id !== id));
        setConfirm({ open: false });
      },
    });
  };

  // SLA handlers
  const handleAddSLA = () => {
    setEditingSLA(null);
    setSlaForm({ name: '', priority: 'medium', dueDelta: 7, categoryId: '' });
    setShowSLAModal(true);
  };

  const handleEditSLA = (sla: SLATemplate) => {
    setEditingSLA(sla);
    setSlaForm({
      name: sla.name,
      priority: sla.priority,
      dueDelta: sla.dueDelta,
      categoryId: sla.categoryId || '',
    });
    setShowSLAModal(true);
  };

  const handleSaveSLA = () => {
    if (!slaForm.name.trim()) return;

    const categoryName = slaForm.categoryId
      ? categories.find(c => c.id === slaForm.categoryId)?.name
      : undefined;

    if (editingSLA) {
      setSlaTemplates(prev => prev.map(s =>
        s.id === editingSLA.id
          ? { ...s, ...slaForm, categoryName }
          : s
      ));
    } else {
      setSlaTemplates(prev => [...prev, {
        id: Date.now().toString(),
        ...slaForm,
        categoryName,
      }]);
    }
    setShowSLAModal(false);
    setEditingSLA(null);
    setSlaForm({ name: '', priority: 'medium', dueDelta: 7, categoryId: '' });
  };

  const handleDeleteSLA = (id: string) => {
    setConfirm({
      open: true,
      type: 'sla',
      id,
      onConfirm: () => {
        setSlaTemplates(prev => prev.filter(s => s.id !== id));
        setConfirm({ open: false });
      },
    });
  };

  const tabs = [

    { id: 'categories' as const, name: 'Categories', icon: Tag },
    { id: 'sla' as const, name: 'SLA Templates', icon: Clock },
    { id: 'integrations' as const, name: 'Integrations', icon: Link2 },
    { id: 'notifications' as const, name: 'Notifications', icon: Bell },
  ];

  return (
    <PageContainer className="space-y-4 md:space-y-6">
      {/* Page Header */}
      <Card className="bg-white rounded-2xl shadow-xl border-0">
        <CardContent className="p-4 md:p-6 lg:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-2" style={{ color: THEME.colors.primary }}>
                System Settings
              </h1>
              <p className="text-sm md:text-base" style={{ color: THEME.colors.gray }}>
                Configure system preferences and manage departments, categories, and integrations
              </p>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border" style={{ backgroundColor: THEME.colors.background, borderColor: THEME.colors.light }}>
              <Settings className="w-5 h-5 md:w-6 md:h-6" style={{ color: THEME.colors.primary }} />
              <span className="text-base md:text-lg font-semibold" style={{ color: THEME.colors.primary }}>
                System Administrator
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings Tabs */}
      <Card className="bg-white rounded-2xl shadow-xl border-0">
        <CardContent className="p-0">
          <div className="border-b" style={{ borderColor: THEME.colors.background }}>
            <nav className="flex flex-wrap gap-2 px-4 md:px-6 lg:px-8 overflow-x-auto">
              {tabs.map((tab) => {
                const IconComponent = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-3 px-4 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    style={activeTab === tab.id ? { borderColor: THEME.colors.primary, color: THEME.colors.primary } : {}}
                  >
                    <IconComponent className="w-4 h-4" />
                    <span>{tab.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-4 md:p-6 lg:p-8">
            {/* Departments Tab */}


            {/* Categories Tab */}
            {activeTab === 'categories' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold" style={{ color: THEME.colors.primary }}>Ticket Categories</h2>
                  <Button
                    variant="primary"
                    leftIcon={<Plus className="w-4 h-4" />}
                    onClick={handleAddCategory}
                  >
                    Add Category
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2" style={{ borderColor: THEME.colors.background }}>
                        <th className="text-left py-3 px-4 text-sm font-semibold" style={{ color: THEME.colors.primary }}>Name</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold" style={{ color: THEME.colors.primary }}>Department</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold" style={{ color: THEME.colors.primary }}>Default Priority</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold" style={{ color: THEME.colors.primary }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((cat) => (
                        <tr key={cat.id} className="border-b hover:bg-gray-50" style={{ borderColor: THEME.colors.background }}>
                          <td className="py-4 px-4 font-medium" style={{ color: THEME.colors.primary }}>{cat.name}</td>
                          <td className="py-4 px-4" style={{ color: THEME.colors.gray }}>{cat.department}</td>
                          <td className="py-4 px-4">
                            <span className="px-2 py-1 rounded text-xs font-medium capitalize" style={{
                              backgroundColor: cat.defaultPriority === 'urgent' ? '#FEE2E2' : cat.defaultPriority === 'high' ? '#FEF3C7' : cat.defaultPriority === 'medium' ? '#DBEAFE' : '#D1FAE5',
                              color: cat.defaultPriority === 'urgent' ? '#991B1B' : cat.defaultPriority === 'high' ? '#92400E' : cat.defaultPriority === 'medium' ? '#1E40AF' : '#065F46',
                            }}>
                              {cat.defaultPriority}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                leftIcon={<Edit className="w-3 h-3" />}
                                onClick={() => handleEditCategory(cat)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                leftIcon={<Trash2 className="w-3 h-3" />}
                                onClick={() => handleDeleteCategory(cat.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SLA Templates Tab */}
            {activeTab === 'sla' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold" style={{ color: THEME.colors.primary }}>SLA Templates</h2>
                  <Button
                    variant="primary"
                    leftIcon={<Plus className="w-4 h-4" />}
                    onClick={handleAddSLA}
                  >
                    Add SLA Template
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2" style={{ borderColor: THEME.colors.background }}>
                        <th className="text-left py-3 px-4 text-sm font-semibold" style={{ color: THEME.colors.primary }}>Name</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold" style={{ color: THEME.colors.primary }}>Priority</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold" style={{ color: THEME.colors.primary }}>Due Delta (Days)</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold" style={{ color: THEME.colors.primary }}>Category</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold" style={{ color: THEME.colors.primary }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {slaTemplates.map((sla) => (
                        <tr key={sla.id} className="border-b hover:bg-gray-50" style={{ borderColor: THEME.colors.background }}>
                          <td className="py-4 px-4 font-medium" style={{ color: THEME.colors.primary }}>{sla.name}</td>
                          <td className="py-4 px-4">
                            <span className="px-2 py-1 rounded text-xs font-medium capitalize" style={{
                              backgroundColor: sla.priority === 'urgent' ? '#FEE2E2' : sla.priority === 'high' ? '#FEF3C7' : sla.priority === 'medium' ? '#DBEAFE' : '#D1FAE5',
                              color: sla.priority === 'urgent' ? '#991B1B' : sla.priority === 'high' ? '#92400E' : sla.priority === 'medium' ? '#1E40AF' : '#065F46',
                            }}>
                              {sla.priority}
                            </span>
                          </td>
                          <td className="py-4 px-4" style={{ color: THEME.colors.gray }}>{sla.dueDelta} days</td>
                          <td className="py-4 px-4" style={{ color: THEME.colors.gray }}>{sla.categoryName || 'All Categories'}</td>
                          <td className="py-4 px-4">
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                leftIcon={<Edit className="w-3 h-3" />}
                                onClick={() => handleEditSLA(sla)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                leftIcon={<Trash2 className="w-3 h-3" />}
                                onClick={() => handleDeleteSLA(sla.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Integrations Tab */}
            {activeTab === 'integrations' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold" style={{ color: THEME.colors.primary }}>SMS Integration</h2>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl border" style={{ borderColor: THEME.colors.background }}>
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-5 h-5" style={{ color: THEME.colors.primary }} />
                      <div>
                        <p className="font-semibold" style={{ color: THEME.colors.primary }}>Enable SMS Integration</p>
                        <p className="text-sm" style={{ color: THEME.colors.gray }}>Sync users and send notifications via SMS</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={integrationSettings.smsEnabled}
                        onChange={(e) => setIntegrationSettings({ ...integrationSettings, smsEnabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                      SMS API Key
                    </label>
                    <input
                      type="password"
                      value={integrationSettings.smsApiKey}
                      onChange={(e) => setIntegrationSettings({ ...integrationSettings, smsApiKey: e.target.value })}
                      placeholder="Enter SMS API key"
                      className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 text-sm md:text-base"
                      style={{ borderColor: THEME.colors.background }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                      SMS API Endpoint
                    </label>
                    <input
                      type="text"
                      value={integrationSettings.smsApiEndpoint}
                      onChange={(e) => setIntegrationSettings({ ...integrationSettings, smsApiEndpoint: e.target.value })}
                      placeholder="https://api.sms-provider.com"
                      className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 text-sm md:text-base"
                      style={{ borderColor: THEME.colors.background }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                      Sync Interval (minutes)
                    </label>
                    <input
                      type="number"
                      value={integrationSettings.syncInterval}
                      onChange={(e) => setIntegrationSettings({ ...integrationSettings, syncInterval: parseInt(e.target.value) || 60 })}
                      min="1"
                      className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 text-sm md:text-base"
                      style={{ borderColor: THEME.colors.background }}
                    />
                    <p className="text-xs mt-1" style={{ color: THEME.colors.gray }}>How often to sync with SMS system</p>
                  </div>

                  {integrationSettings.lastSync && (
                    <div className="p-3 rounded-lg" style={{ backgroundColor: THEME.colors.background }}>
                      <p className="text-sm" style={{ color: THEME.colors.gray }}>
                        Last sync: {new Date(integrationSettings.lastSync).toLocaleString()}
                      </p>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    leftIcon={<RefreshCw className="w-4 h-4" />}
                    onClick={() => setIntegrationSettings({ ...integrationSettings, lastSync: new Date().toISOString() })}
                  >
                    Test Connection
                  </Button>
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold" style={{ color: THEME.colors.primary }}>Notification Settings</h2>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl border" style={{ borderColor: THEME.colors.background }}>
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5" style={{ color: THEME.colors.primary }} />
                      <div>
                        <p className="font-semibold" style={{ color: THEME.colors.primary }}>Email Notifications</p>
                        <p className="text-sm" style={{ color: THEME.colors.gray }}>Send email notifications for ticket updates</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationSettings.emailEnabled}
                        onChange={(e) => setNotificationSettings({ ...notificationSettings, emailEnabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                      Email From Address
                    </label>
                    <input
                      type="email"
                      value={notificationSettings.emailFrom}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, emailFrom: e.target.value })}
                      placeholder="noreply@helpdesk.com"
                      className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 text-sm md:text-base"
                      style={{ borderColor: THEME.colors.background }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                      Reminder Interval (hours)
                    </label>
                    <input
                      type="number"
                      value={notificationSettings.reminderInterval}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, reminderInterval: parseInt(e.target.value) || 24 })}
                      min="1"
                      className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 text-sm md:text-base"
                      style={{ borderColor: THEME.colors.background }}
                    />
                    <p className="text-xs mt-1" style={{ color: THEME.colors.gray }}>How often to send reminder notifications</p>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl border" style={{ borderColor: THEME.colors.background }}>
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5" style={{ color: THEME.colors.primary }} />
                      <div>
                        <p className="font-semibold" style={{ color: THEME.colors.primary }}>Auto-Close Tickets</p>
                        <p className="text-sm" style={{ color: THEME.colors.gray }}>Automatically close resolved tickets after period</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationSettings.autoCloseEnabled}
                        onChange={(e) => setNotificationSettings({ ...notificationSettings, autoCloseEnabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {notificationSettings.autoCloseEnabled && (
                    <div>
                      <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                        Auto-Close After (days)
                      </label>
                      <input
                        type="number"
                        value={notificationSettings.autoCloseDays}
                        onChange={(e) => setNotificationSettings({ ...notificationSettings, autoCloseDays: parseInt(e.target.value) || 3 })}
                        min="1"
                        className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 text-sm md:text-base"
                        style={{ borderColor: THEME.colors.background }}
                      />
                      <p className="text-xs mt-1" style={{ color: THEME.colors.gray }}>Default: 3 days</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Save Actions */}
      <Card className="bg-white rounded-2xl shadow-xl border-0">
        <CardContent className="p-4 md:p-6 lg:p-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {saveMessage && (
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${saveMessage.includes('success') ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                }`}>
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">{saveMessage}</span>
              </div>
            )}
            <div className="flex gap-3 ml-auto">
              <Button
                variant="primary"
                leftIcon={<Save className="w-4 h-4" />}
                onClick={handleSave}
                loading={saving}
              >
                Save Settings
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>



      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold" style={{ color: THEME.colors.primary }}>
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </h2>
              <button onClick={() => setShowCategoryModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" style={{ color: THEME.colors.gray }} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="Enter category name"
                  className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2"
                  style={{ borderColor: THEME.colors.background }}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                  Department <span className="text-red-500">*</span>
                </label>
                <select
                  value={categoryForm.department}
                  onChange={(e) => setCategoryForm({ ...categoryForm, department: e.target.value })}
                  className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2"
                  style={{ borderColor: THEME.colors.background }}
                >
                  <option value="">Select Department</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.name}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                  Default Priority <span className="text-red-500">*</span>
                </label>
                <select
                  value={categoryForm.defaultPriority}
                  onChange={(e) => setCategoryForm({ ...categoryForm, defaultPriority: e.target.value as any })}
                  className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2"
                  style={{ borderColor: THEME.colors.background }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50 rounded-b-xl">
              <Button variant="outline" onClick={() => setShowCategoryModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleSaveCategory}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {/* SLA Modal */}
      {showSLAModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold" style={{ color: THEME.colors.primary }}>
                {editingSLA ? 'Edit SLA Template' : 'Add SLA Template'}
              </h2>
              <button onClick={() => setShowSLAModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" style={{ color: THEME.colors.gray }} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                  Template Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={slaForm.name}
                  onChange={(e) => setSlaForm({ ...slaForm, name: e.target.value })}
                  placeholder="Enter SLA template name"
                  className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2"
                  style={{ borderColor: THEME.colors.background }}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                  Priority <span className="text-red-500">*</span>
                </label>
                <select
                  value={slaForm.priority}
                  onChange={(e) => setSlaForm({ ...slaForm, priority: e.target.value as any })}
                  className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2"
                  style={{ borderColor: THEME.colors.background }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                  Due Delta (Days) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={slaForm.dueDelta}
                  onChange={(e) => setSlaForm({ ...slaForm, dueDelta: parseInt(e.target.value) || 7 })}
                  min="1"
                  className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2"
                  style={{ borderColor: THEME.colors.background }}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: THEME.colors.primary }}>
                  Category (Optional)
                </label>
                <select
                  value={slaForm.categoryId}
                  onChange={(e) => setSlaForm({ ...slaForm, categoryId: e.target.value })}
                  className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2"
                  style={{ borderColor: THEME.colors.background }}
                >
                  <option value="">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50 rounded-b-xl">
              <Button variant="outline" onClick={() => setShowSLAModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleSaveSLA}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirm.open}
        title={`Delete ${confirm.type || 'item'}?`}
        description="This action cannot be undone."
        onClose={() => setConfirm({ open: false })}
        onConfirm={() => {
          if (confirm.onConfirm) confirm.onConfirm();
        }}
        type="danger"
        confirmText="Delete"
      />
    </PageContainer>
  );
};

export default AdminSettingsPage;

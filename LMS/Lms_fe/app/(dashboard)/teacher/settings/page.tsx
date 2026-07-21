'use client';

import { useState, useEffect } from 'react';
import { 
  Settings, User, Lock, Mail, Phone, Shield, 
  Save, RefreshCw, Key, Image as ImageIcon, CheckCircle2
} from 'lucide-react';
import { authAPI, userAPI } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

type TabType = 'profile' | 'security';

export default function TeacherSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Profile Form State
  const [profileData, setProfileData] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    bio: '',
  });

  // Password Form State
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const data = await authAPI.getCurrentUser();
      setUser(data);
      const nameParts = data.full_name?.split(' ') || ['', ''];
      setProfileData({
        username: data.username || '',
        email: data.email || '',
        first_name: data.first_name || nameParts[0] || '',
        last_name: data.last_name || nameParts.slice(1).join(' ') || '',
        phone: data.phone_number || data.phone || '',
        bio: data.bio || '',
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      toast.error('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    try {
      setSaving(true);
      const full_name = `${profileData.first_name} ${profileData.last_name}`.trim();
      await userAPI.update(user.id, {
        full_name,
        phone_number: profileData.phone,
        bio: profileData.bio,
      });
      toast.success('Profile updated successfully');
      fetchUserData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Profile update failed');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    try {
      setSaving(true);
      await authAPI.changePassword(passwordData.oldPassword, passwordData.newPassword);
      toast.success('Password updated successfully');
      setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Password update failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-brand-teal animate-spin" />
        <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 pb-12 premium-dashboard-scope animate-in fade-in duration-700">
      
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <Settings className="w-7 h-7 text-brand-teal" />
          Settings
        </h1>
        <p className="text-sm text-slate-400 font-bold mt-1">Update your profile information and manage your account security.</p>
      </div>

      {/* â”€â”€ Tab Switcher â”€â”€ */}
      <div className="flex items-center p-1.5 bg-slate-100 rounded-2xl w-fit mb-4">
        <button
          onClick={() => setActiveTab('profile')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
            activeTab === 'profile' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <User className="w-3.5 h-3.5" />
          Profile
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
            activeTab === 'security' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Lock className="w-3.5 h-3.5" />
          Security
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: UI Overview Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="ui-card p-8 bg-slate-900 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-teal/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl transition-all group-hover:bg-brand-teal/20" />
            
            <div className="relative mb-8 flex flex-col items-center">
              <div className="w-24 h-24 rounded-3xl bg-brand-dark border-4 border-slate-800 flex items-center justify-center text-white text-3xl font-black shadow-2xl overflow-hidden group-hover:scale-105 transition-transform">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
              <button className="absolute -bottom-2 -right-2 p-2.5 bg-brand-teal text-white rounded-xl shadow-lg hover:scale-110 active:scale-90 transition-all border-4 border-slate-900">
                <ImageIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="text-center space-y-1">
              <h2 className="text-xl font-black text-white">{user?.full_name}</h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">{user?.role} Account</p>
            </div>

            <div className="mt-8 pt-8 border-t border-slate-800 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Account Status</span>
                <span className="flex items-center gap-1.5 px-3 py-1 bg-teal-500/10 text-teal-500 rounded-full text-[10px] font-black uppercase tracking-widest">
                  <CheckCircle2 className="w-3 h-3" /> Active
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Member Since</span>
                <span className="text-[11px] font-bold text-white uppercase tracking-widest">
                  {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>

          <div className="ui-card p-6 border-l-4 border-brand-teal">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4 text-brand-teal" />
              Verified Account
            </h4>
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              Your profile is verified. Some changes may need admin approval.
            </p>
          </div>
        </div>

        {/* Right Column: Main Form */}
        <div className="lg:col-span-2">
          {activeTab === 'profile' ? (
            <div className="ui-card p-8 lg:p-12 animate-in fade-in slide-in-from-right-4 duration-500">
              <form onSubmit={handleProfileUpdate} className="space-y-8">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-1.5 h-6 bg-brand-teal rounded-full" />
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-widest">Profile Information</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">First Name</label>
                    <input
                      type="text"
                      value={profileData.first_name}
                      onChange={(e) => setProfileData({ ...profileData, first_name: e.target.value })}
                      className="form-input !py-3.5"
                      placeholder="Enter first name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Last Name</label>
                    <input
                      type="text"
                      value={profileData.last_name}
                      onChange={(e) => setProfileData({ ...profileData, last_name: e.target.value })}
                      className="form-input !py-3.5"
                      placeholder="Enter last name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5" /> Email Address
                    </label>
                    <input
                      type="email"
                      value={profileData.email}
                      disabled
                      className="form-input !py-3.5 bg-slate-50 cursor-not-allowed opacity-60"
                      title="Email cannot be modified directly"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5" /> Contact Number
                    </label>
                    <input
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      className="form-input !py-3.5"
                      placeholder="+92 XXX XXXXXXX"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Bio / Description</label>
                  <textarea
                    value={profileData.bio}
                    onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                    rows={4}
                    className="form-input !py-3.5 resize-none scrollbar-hide"
                    placeholder="A short bio for your profile..."
                  />
                </div>

                <div className="pt-6 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary !px-10 !py-4 flex items-center gap-3"
                  >
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span className="font-black uppercase tracking-widest">Update Profile</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="ui-card p-8 lg:p-12 animate-in fade-in slide-in-from-right-4 duration-500">
              <form onSubmit={handlePasswordUpdate} className="space-y-8">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-1.5 h-6 bg-brand-orange rounded-full" />
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-widest">Change Password</h3>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Current Password</label>
                    <input
                      type="password"
                      value={passwordData.oldPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                      className="form-input !py-3.5"
                      placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                      required
                    />
                  </div>
                  
                  <div className="h-px bg-slate-50 my-2" />

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">New Password</label>
                    <input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      className="form-input !py-3.5"
                      placeholder="Enter new password"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Confirm New Password</label>
                    <input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      className="form-input !py-3.5"
                      placeholder="Confirm new password"
                      required
                    />
                  </div>
                </div>

                <div className="pt-6 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary !bg-slate-900 !px-10 !py-4 flex items-center gap-3"
                  >
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4 text-brand-teal" />}
                    <span className="font-black uppercase tracking-widest">Update Password</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

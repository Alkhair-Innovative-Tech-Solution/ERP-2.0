'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { User as UserType } from '../../types';
import { User as UserIcon, Mail, Building, Shield, Settings, Wrench, FileText, Calendar, Edit3, Save, X, Camera } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Button } from '../ui/Button';
import { THEME } from '../../lib/theme';

const DynamicProfile: React.FC = () => {
  const { user, setUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editedUser, setEditedUser] = useState<UserType | null>(user);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwErr, setPwErr] = useState<string>('');
  const [pwSuccess, setPwSuccess] = useState<string>('');
  const [contactForm, setContactForm] = useState({ phone: '', altEmail: '' });
  const [contactErr, setContactErr] = useState<string>('');
  const [contactSuccess, setContactSuccess] = useState<string>('');

  // Initialize contact form from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setContactForm({
        phone: localStorage.getItem('user_phone') || '',
        altEmail: localStorage.getItem('user_alt_email') || ''
      });
    }
  }, []);

  // Update editedUser when user changes
  useEffect(() => {
    setEditedUser(user);
  }, [user]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: THEME.colors.primary }}></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  const handleEdit = () => {
    setEditedUser({ ...user });
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!editedUser) return;

    setUser(editedUser);
    setIsEditing(false);

    // Update localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(editedUser));

      // Dispatch avatar update event
      if (editedUser.avatar !== user?.avatar) {
        const event = new CustomEvent('avatarUpdated', { detail: editedUser.avatar });
        window.dispatchEvent(event);
      }
    }
  };

  const handleCancel = () => {
    setEditedUser(user);
    setIsEditing(false);
  };

  const handleInputChange = (field: string, value: string) => {
    if (!editedUser) return;

    setEditedUser(prev => ({
      ...prev!,
      [field]: value
    }));
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if file is an image
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }

    // Create a FileReader to convert image to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;

      // Update the user avatar
      const updatedUser = {
        ...user,
        avatar: base64String
      };

      setUser(updatedUser);
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(updatedUser));

        // Dispatch avatar update event to update navbar
        const event = new CustomEvent('avatarUpdated', { detail: base64String });
        window.dispatchEvent(event);
      }

      // Update editedUser if in edit mode
      if (editedUser) {
        setEditedUser({
          ...editedUser,
          avatar: base64String
        });
      }

      // simple success indicator
      setContactSuccess('Profile image updated successfully!');
      setTimeout(() => setContactSuccess(''), 2000);
    };

    reader.readAsDataURL(file);
  };

  const handleCameraClick = () => {
    fileInputRef.current?.click();
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return Settings;
      case 'moderator': return Shield;
      case 'assignee': return Wrench;
      case 'requestor': return FileText;
      default: return UserIcon;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return { color: THEME.colors.primary, backgroundColor: THEME.colors.background };
      case 'moderator': return { color: THEME.colors.primary, backgroundColor: THEME.colors.background };
      case 'assignee': return { color: THEME.colors.primary, backgroundColor: THEME.colors.background };
      case 'requestor': return { color: THEME.colors.primary, backgroundColor: THEME.colors.background };
      default: return { color: THEME.colors.gray, backgroundColor: THEME.colors.background };
    }
  };

  const getRoleDescription = (role: string) => {
    switch (role) {
      case 'admin': return 'System Administrator - Full system access and management';
      case 'moderator': return 'Ticket Moderator - Assign and manage tickets';
      case 'assignee': return 'Department Staff - Handle assigned tasks';
      case 'requestor': return 'Request Submitter - Create and track requests';
      default: return 'User';
    }
  };

  const RoleIcon = getRoleIcon(user.role);

  const roleColorStyle = getRoleColor(user.role);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6" style={{ backgroundColor: THEME.colors.primary }}>
            <UserIcon className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-3" style={{ color: THEME.colors.primary }}>
            Profile Settings
          </h1>
          <p className="text-lg" style={{ color: THEME.colors.gray }}>Manage your account information and preferences</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />

          {/* Profile Card */}
          <div className="xl:col-span-1">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="p-6 text-center" style={{ backgroundColor: THEME.colors.primary }}>
                <div className="relative inline-block">
                  <div className="h-32 w-32 mx-auto rounded-full bg-white flex items-center justify-center text-4xl font-bold shadow-lg overflow-hidden relative">
                    {user.avatar && (user.avatar.startsWith('data:image') || user.avatar.startsWith('http') || user.avatar.startsWith('/')) ? (
                      <img
                        src={user.avatar}
                        alt="Profile"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : null}
                    {(!user.avatar || (!user.avatar.startsWith('data:image') && !user.avatar.startsWith('http') && !user.avatar.startsWith('/'))) && (
                      <span style={{ color: THEME.colors.primary }}>
                        {user.avatar && user.avatar.length <= 3 ? user.avatar : (user.name?.charAt(0) || 'U')}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleCameraClick}
                    className="absolute bottom-0 right-0 bg-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110"
                    style={{ color: THEME.colors.primary }}
                    title="Change Profile Picture"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                </div>

                <div className="mt-6">
                  <h2 className="text-2xl font-bold text-white mb-2">{user.name}</h2>
                  <p className="mb-4" style={{ color: THEME.colors.light }}>{user.email}</p>
                  <div className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold text-white" style={{ backgroundColor: THEME.colors.medium }}>
                    <RoleIcon className="w-4 h-4 mr-2" />
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </div>
                </div>
              </div>

              <div className="p-6">
                <p className="text-gray-600 text-center leading-relaxed">
                  {getRoleDescription(user.role)}
                </p>
                <div className="mt-4 flex items-center justify-center text-sm text-gray-500">
                  <Calendar className="w-4 h-4 mr-2" />
                  Member since: {new Date().toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>

          {/* Profile Details */}
          <div className="xl:col-span-3">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-8 py-6 border-b border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <h3 className="text-2xl font-bold text-gray-800">Personal Information</h3>
                  {user.role === 'admin' && (
                    <>
                      {!isEditing ? (
                        <button
                          onClick={handleEdit}
                          className="inline-flex items-center px-6 py-3 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                          style={{ backgroundColor: THEME.colors.primary }}
                        >
                          <Edit3 className="w-5 h-5 mr-2" />
                          Edit Profile
                        </button>
                      ) : (
                        <div className="flex space-x-3">
                          <button
                            onClick={handleSave}
                            className="inline-flex items-center px-6 py-3 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                            style={{ backgroundColor: THEME.colors.primary }}
                          >
                            <Save className="w-5 h-5 mr-2" />
                            Save Changes
                          </button>
                          <button
                            onClick={handleCancel}
                            className="inline-flex items-center px-6 py-3 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                            style={{ backgroundColor: THEME.colors.gray }}
                          >
                            <X className="w-5 h-5 mr-2" />
                            Cancel
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Name */}
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      <UserIcon className="w-4 h-4 inline mr-2" />
                      Full Name
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editedUser?.name || ''}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        placeholder="Enter your full name"
                        className="w-full px-4 py-3 border-2 rounded-xl transition-all duration-200 text-lg"
                        style={{ borderColor: THEME.colors.gray }}
                        onFocus={(e) => e.target.style.borderColor = THEME.colors.primary}
                        onBlur={(e) => e.target.style.borderColor = THEME.colors.gray}
                      />
                    ) : (
                      <div className="px-4 py-3 bg-gray-50 rounded-xl border-2 border-gray-100">
                        <p className="text-gray-800 text-lg font-medium">{user.name}</p>
                      </div>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      <Mail className="w-4 h-4 inline mr-2" />
                      Email Address
                    </label>
                    {isEditing ? (
                      <input
                        type="email"
                        value={editedUser?.email || ''}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        placeholder="Enter your email"
                        className="w-full px-4 py-3 border-2 rounded-xl transition-all duration-200 text-lg"
                        style={{ borderColor: THEME.colors.gray }}
                        onFocus={(e) => e.target.style.borderColor = THEME.colors.primary}
                        onBlur={(e) => e.target.style.borderColor = THEME.colors.gray}
                      />
                    ) : (
                      <div className="px-4 py-3 bg-gray-50 rounded-xl border-2 border-gray-100">
                        <p className="text-gray-800 text-lg font-medium">{user.email}</p>
                      </div>
                    )}
                  </div>

                  {/* Department */}
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      <Building className="w-4 h-4 inline mr-2" />
                      Department
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editedUser?.department || ''}
                        onChange={(e) => handleInputChange('department', e.target.value)}
                        placeholder="Enter your department"
                        className="w-full px-4 py-3 border-2 rounded-xl transition-all duration-200 text-lg"
                        style={{ borderColor: THEME.colors.gray }}
                        onFocus={(e) => e.target.style.borderColor = THEME.colors.primary}
                        onBlur={(e) => e.target.style.borderColor = THEME.colors.gray}
                      />
                    ) : (
                      <div className="px-4 py-3 bg-gray-50 rounded-xl border-2 border-gray-100">
                        <p className="text-gray-800 text-lg font-medium">{user.department || 'Not specified'}</p>
                      </div>
                    )}
                  </div>

                  {/* Role */}
                  <div className="space-y-3">
                    <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      <RoleIcon className="w-4 h-4 inline mr-2" />
                      Role
                    </label>
                    <div className="px-4 py-3 rounded-xl border-2" style={{ backgroundColor: THEME.colors.background, borderColor: THEME.colors.light }}>
                      <p className="text-lg font-semibold" style={{ color: THEME.colors.primary }}>{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</p>
                    </div>
                  </div>
                </div>

                {/* Profile Image Upload */}
                <div className="mt-12 pt-8 border-t-2 border-gray-100">
                  <h4 className="text-xl font-bold text-gray-800 mb-6">Profile Picture</h4>
                  <div className="rounded-2xl p-6 border" style={{ backgroundColor: THEME.colors.background, borderColor: THEME.colors.light }}>
                    <div className="flex items-center gap-6">
                      <div className="flex-shrink-0">
                        <div className="h-20 w-20 rounded-full bg-white flex items-center justify-center text-2xl font-bold shadow-lg overflow-hidden relative">
                          {user.avatar && (user.avatar.startsWith('data:image') || user.avatar.startsWith('http') || user.avatar.startsWith('/')) ? (
                            <img
                              src={user.avatar}
                              alt="Profile"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : null}
                          {(!user.avatar || (!user.avatar.startsWith('data:image') && !user.avatar.startsWith('http') && !user.avatar.startsWith('/'))) && (
                            <span style={{ color: THEME.colors.primary }}>
                              {user.avatar && user.avatar.length <= 3 ? user.avatar : (user.name?.charAt(0) || 'U')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-base leading-relaxed mb-3" style={{ color: THEME.colors.gray }}>
                          Update your profile picture to help people recognize you easily. The image will appear in your navbar across all pages.
                        </p>
                        <button
                          onClick={handleCameraClick}
                          className="inline-flex items-center px-6 py-2 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                          style={{ backgroundColor: THEME.colors.primary }}
                        >
                          <Camera className="w-4 h-4 mr-2" />
                          {user.avatar ? 'Change Profile Picture' : 'Upload Profile Picture'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Role-specific Information */}
                <div className="mt-8 pt-8 border-t-2 border-gray-100">
                  <h4 className="text-xl font-bold text-gray-800 mb-6">Role Information</h4>
                  <div className="rounded-2xl p-6 border" style={{ backgroundColor: THEME.colors.background, borderColor: THEME.colors.light }}>
                    <p className="text-lg leading-relaxed mb-4" style={{ color: THEME.colors.gray }}>
                      {getRoleDescription(user.role)}
                    </p>
                    <div className="flex items-center" style={{ color: THEME.colors.gray }}>
                      <Calendar className="w-5 h-5 mr-3" />
                      <span className="font-medium">Member since: {new Date().toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Update Contact */}
                <div className="mt-8 pt-8 border-t-2 border-gray-100">
                  <h4 className="text-xl font-bold text-gray-800 mb-6">Update Contact</h4>
                  {contactSuccess && (
                    <div className="mb-4 p-3 rounded border border-green-200 bg-green-50 text-green-700">{contactSuccess}</div>
                  )}
                  {contactErr && (
                    <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-red-700">{contactErr}</div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="tel"
                      placeholder="Phone number"
                      value={contactForm.phone}
                      onChange={(e) => setContactForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-4 py-3 border-2 rounded-xl transition-all duration-200"
                      style={{ borderColor: THEME.colors.gray }}
                    />
                    <input
                      type="email"
                      placeholder="Alternate email"
                      value={contactForm.altEmail}
                      onChange={(e) => setContactForm(prev => ({ ...prev, altEmail: e.target.value }))}
                      className="w-full px-4 py-3 border-2 rounded-xl transition-all duration-200"
                      style={{ borderColor: THEME.colors.gray }}
                    />
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={() => {
                        // simple inline validation
                        if (contactForm.phone && !/^\+?[0-9\-\s]{7,15}$/.test(contactForm.phone)) {
                          setContactErr('Invalid phone number');
                          setTimeout(() => setContactErr(''), 2000);
                          return;
                        }
                        if (contactForm.altEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactForm.altEmail)) {
                          setContactErr('Invalid email');
                          setTimeout(() => setContactErr(''), 2000);
                          return;
                        }
                        if (typeof window !== 'undefined') {
                          localStorage.setItem('user_phone', contactForm.phone);
                          localStorage.setItem('user_alt_email', contactForm.altEmail);
                        }
                        setContactSuccess('Contact details updated');
                        setTimeout(() => setContactSuccess(''), 2000);
                      }}
                      className="inline-flex items-center px-6 py-2 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                      style={{ backgroundColor: THEME.colors.primary }}
                    >
                      Save Contact
                    </button>
                  </div>
                </div>

                {/* Change Password */}
                <div className="mt-8 pt-8 border-t-2 border-gray-100">
                  <h4 className="text-xl font-bold text-gray-800 mb-6">Change Password</h4>
                  {pwSuccess && (
                    <div className="mb-4 p-3 rounded border border-green-200 bg-green-50 text-green-700">{pwSuccess}</div>
                  )}
                  {pwErr && (
                    <div className="mb-4 p-3 rounded border border-red-200 bg-red-50 text-red-700">{pwErr}</div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input
                      type="password"
                      placeholder="Current password"
                      value={pwForm.current}
                      onChange={(e) => setPwForm(prev => ({ ...prev, current: e.target.value }))}
                      className="w-full px-4 py-3 border-2 rounded-xl transition-all duration-200"
                      style={{ borderColor: THEME.colors.gray }}
                    />
                    <input
                      type="password"
                      placeholder="New password"
                      value={pwForm.next}
                      onChange={(e) => setPwForm(prev => ({ ...prev, next: e.target.value }))}
                      className="w-full px-4 py-3 border-2 rounded-xl transition-all duration-200"
                      style={{ borderColor: THEME.colors.gray }}
                    />
                    <input
                      type="password"
                      placeholder="Confirm new password"
                      value={pwForm.confirm}
                      onChange={(e) => setPwForm(prev => ({ ...prev, confirm: e.target.value }))}
                      className="w-full px-4 py-3 border-2 rounded-xl transition-all duration-200"
                      style={{ borderColor: THEME.colors.gray }}
                    />
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={() => {
                        // inline validation only (demo)
                        if (pwForm.next.length < 6) {
                          setPwErr('Password must be at least 6 characters');
                          setTimeout(() => setPwErr(''), 2000);
                          return;
                        }
                        if (pwForm.next !== pwForm.confirm) {
                          setPwErr('Passwords do not match');
                          setTimeout(() => setPwErr(''), 2000);
                          return;
                        }
                        setPwForm({ current: '', next: '', confirm: '' });
                        setPwSuccess('Password changed successfully');
                        setTimeout(() => setPwSuccess(''), 2000);
                      }}
                      className="inline-flex items-center px-6 py-2 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                      style={{ backgroundColor: THEME.colors.primary }}
                    >
                      Update Password
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DynamicProfile;
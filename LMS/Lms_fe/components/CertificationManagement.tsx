'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Award, Search, Plus, Edit, Trash2 } from 'lucide-react';

interface Certification {
  id: number;
  title: string;
  user_id: string;
  course_id: string;
  issued_date: string;
  certificate_url: string;
}

export default function CertificationManagement() {
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchCertifications();
  }, []);

  const fetchCertifications = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await axios.get('http://localhost:8004/api/certifications/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCertifications(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error fetching certifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCertifications = certifications.filter((cert) =>
    cert.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="text-center py-12">Loading certifications...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold text-gray-900">Certification Management</h2>
        <button className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Issue Certificate
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search certifications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Certificate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Course ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Issued Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCertifications.map((cert) => (
                <tr key={cert.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                        <Award className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{cert.title}</div>
                        {cert.certificate_url && (
                          <a
                            href={cert.certificate_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary-600 hover:underline"
                          >
                            View Certificate
                          </a>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {cert.user_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {cert.course_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(cert.issued_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button className="text-primary-600 hover:text-primary-900">
                        <Edit className="w-5 h-5" />
                      </button>
                      <button className="text-red-600 hover:text-red-900">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredCertifications.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Award className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>No certifications found</p>
          </div>
        )}
      </div>
    </div>
  );
}


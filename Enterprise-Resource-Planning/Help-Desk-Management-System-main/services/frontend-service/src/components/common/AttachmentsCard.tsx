'use client';

import React from 'react';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Download, File, Image as ImageIcon, Video, FileText, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { THEME } from '../../lib/theme';
import { formatDate, formatFileSize } from '../../lib/helpers';

export interface Attachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploadDate: string;
  scanStatus?: 'pending' | 'scanning' | 'safe' | 'infected';
  source?: 'ticket' | 'chat';
}

interface AttachmentsCardProps {
  ticketAttachments?: string[] | Attachment[];
  chatAttachments?: Attachment[];
  onDownload?: (attachment: Attachment | string) => void;
}

export const AttachmentsCard: React.FC<AttachmentsCardProps> = ({
  ticketAttachments = [],
  chatAttachments = [],
  onDownload,
}) => {
  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return ImageIcon;
    if (type.startsWith('video/')) return Video;
    if (type.includes('pdf')) return FileText;
    return File;
  };

  const getScanStatusIcon = (status?: string) => {
    switch (status) {
      case 'safe':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'infected':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'scanning':
        return <Loader className="w-4 h-4 text-yellow-500 animate-spin" />;
      default:
        return null;
    }
  };

  const renderAttachment = (attachment: Attachment | string, source: 'ticket' | 'chat' = 'ticket') => {
    const isString = typeof attachment === 'string';
    const att: Attachment = isString
      ? {
          id: attachment,
          name: attachment,
          url: attachment,
          size: 0,
          type: 'unknown',
          uploadDate: new Date().toISOString(),
          source,
        }
      : { ...attachment, source };

    const FileIcon = getFileIcon(att.type);

    return (
      <div
        key={att.id}
        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0 p-2 rounded bg-white">
            <FileIcon className="w-5 h-5" style={{ color: THEME.colors.primary }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate" title={att.name}>
              {att.name}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {att.size > 0 && (
                <p className="text-xs text-gray-500">{formatFileSize(att.size)}</p>
              )}
              {att.uploadDate && (
                <>
                  <span className="text-xs text-gray-400">•</span>
                  <p className="text-xs text-gray-500">
                    {formatDate(att.uploadDate, 'short')}
                  </p>
                </>
              )}
              {att.scanStatus && (
                <>
                  <span className="text-xs text-gray-400">•</span>
                  <div className="flex items-center gap-1">
                    {getScanStatusIcon(att.scanStatus)}
                    <span className="text-xs text-gray-500 capitalize">{att.scanStatus}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => onDownload?.(attachment)}
          className="flex-shrink-0 p-2 hover:bg-blue-50 rounded-lg transition-colors ml-2"
          title="Download file"
        >
          <Download className="w-4 h-4" style={{ color: THEME.colors.primary }} />
        </button>
      </div>
    );
  };

  const allTicketAttachments = ticketAttachments || [];
  const allChatAttachments = chatAttachments || [];
  const hasAttachments = allTicketAttachments.length > 0 || allChatAttachments.length > 0;

  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold" style={{ color: THEME.colors.primary }}>
          Attachments
        </h3>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasAttachments ? (
          <p className="text-sm text-gray-500 text-center py-4">No attachments</p>
        ) : (
          <>
            {allTicketAttachments.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Ticket Attachments</h4>
                <div className="space-y-2">
                  {allTicketAttachments.map((att, index) =>
                    renderAttachment(att as any, 'ticket')
                  )}
                </div>
              </div>
            )}

            {allChatAttachments.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Chat Attachments</h4>
                <div className="space-y-2">
                  {allChatAttachments.map((att) => renderAttachment(att, 'chat'))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};


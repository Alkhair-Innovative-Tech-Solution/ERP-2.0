import React from 'react';
import { Button } from '../ui/Button';
import { Eye, UserPlus, CheckCircle, XCircle } from 'lucide-react';

interface ViewButtonProps {
  onClick: () => void;
}

export const ViewButton: React.FC<ViewButtonProps> = ({ onClick }) => {
  return (
    <Button
      variant="primary"
      size="sm"
      leftIcon={<Eye className="w-3 h-3" />}
      onClick={onClick}
    >
      View
    </Button>
  );
};

interface AssignButtonProps {
  onClick: () => void;
}

export const AssignButton: React.FC<AssignButtonProps> = ({ onClick }) => {
  return (
    <Button
      variant="success"
      size="sm"
      leftIcon={<UserPlus className="w-3 h-3" />}
      onClick={onClick}
    >
      Assign Now
    </Button>
  );
};

interface ReassignButtonProps {
  onClick: () => void;
  variant?: 'success' | 'danger';
}

export const ReassignButton: React.FC<ReassignButtonProps> = ({ onClick, variant = 'success' }) => {
  return (
    <Button
      variant={variant}
      size="sm"
      leftIcon={<UserPlus className="w-3 h-3" />}
      onClick={onClick}
    >
      Reassign
    </Button>
  );
};

interface ApproveButtonProps {
  onClick: () => void;
  isApproved?: boolean;
}

export const ApproveButton: React.FC<ApproveButtonProps> = ({ onClick, isApproved = false }) => {
  if (isApproved) {
    return (
      <Button
        variant="success"
        size="sm"
        leftIcon={<CheckCircle className="w-4 h-4" />}
        onClick={onClick}
      >
        Approved
      </Button>
    );
  }

  return (
    <Button
      variant="danger"
      size="sm"
      leftIcon={<CheckCircle className="w-3 h-3" />}
      onClick={onClick}
    >
      Approve
    </Button>
  );
};
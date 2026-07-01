import React from 'react';
import { Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  message?: string;
}

/**
 * Shared success popup — mirrors the invalid-file error dialog but green with a
 * checkmark. Used across every tool form so submissions get a consistent
 * "please allow up to 6 hours" confirmation.
 */
const SuccessDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  title = 'Success',
  message = 'Submission received. Please allow up to 6 hours for processing.',
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader className="flex flex-col items-center justify-center text-center">
        <div className="rounded-full border-2 border-green-500 p-4 w-16 h-16 flex items-center justify-center mb-4">
          <Check className="h-8 w-8 text-green-500" />
        </div>
        <DialogTitle className="text-xl">{title}</DialogTitle>
      </DialogHeader>
      <div className="text-center pb-4 pt-2">
        <p className="text-muted-foreground">{message}</p>
      </div>
      <div className="flex justify-center">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onOpenChange(false)}
          className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-8 rounded"
        >
          OK
        </motion.button>
      </div>
    </DialogContent>
  </Dialog>
);

export default SuccessDialog;

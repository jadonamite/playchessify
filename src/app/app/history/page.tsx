import { useState, useEffect } from 'react';
import { HistoryContent } from '@/components/lobby/HistoryContent';

const useHistoryPage = () => {
  return <HistoryContent />;
};

export default function HistoryPage() {
  return useHistoryPage();
}
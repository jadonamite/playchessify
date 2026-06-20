import { useState, useEffect } from 'react';
import ChessifyLanding from '@/components/landing/v2/ChessifyLanding';

const useLandingPage = () => {
  return <ChessifyLanding />;
};

export default function LandingV2Page() {
  return useLandingPage();
}
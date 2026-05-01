import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClimberArcadeExperience } from './ClimberArcadeExperience';

const container = document.getElementById('app');
if (!container) throw new Error('Missing #app mount point');

createRoot(container).render(
  <StrictMode>
    <ClimberArcadeExperience title="玩具世界攀爬" />
  </StrictMode>,
);

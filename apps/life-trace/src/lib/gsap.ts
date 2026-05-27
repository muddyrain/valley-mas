import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

gsap.registerPlugin(useGSAP);

gsap.defaults({
  duration: 0.42,
  ease: 'power2.out',
});

export { gsap, useGSAP };

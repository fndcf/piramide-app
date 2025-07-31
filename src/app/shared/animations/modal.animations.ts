// src/app/shared/animations/modal.animations.ts
import { trigger, state, style, transition, animate } from '@angular/animations';

export const modalAnimations = [
  trigger('fadeInOut', [
    transition(':enter', [
      style({ opacity: 0 }),
      animate('200ms ease-in', style({ opacity: 1 }))
    ]),
    transition(':leave', [
      animate('200ms ease-out', style({ opacity: 0 }))
    ])
  ]),
  trigger('slideInOut', [
    transition(':enter', [
      style({ transform: 'scale(0.8) translateY(-50px)', opacity: 0 }),
      animate('250ms ease-out', style({ transform: 'scale(1) translateY(0)', opacity: 1 }))
    ]),
    transition(':leave', [
      animate('200ms ease-in', style({ transform: 'scale(0.8) translateY(-50px)', opacity: 0 }))
    ])
  ])
];
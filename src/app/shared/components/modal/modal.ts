// src/app/shared/components/modal/modal.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { modalAnimations } from '../../animations/modal.animations';

@Component({
  selector: 'app-modal',
  imports: [CommonModule], // ✅ Para ngIf, ngClass
  templateUrl: './modal.html',
  styleUrls: ['./modal.scss'],
  animations: modalAnimations
})
export class ModalComponent {
  @Input() isOpen: boolean = false;
  @Input() title: string = '';
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
  @Input() showCloseButton: boolean = true;
  @Output() closeModal = new EventEmitter<void>();

  onClose(): void {
    this.closeModal.emit();
  }

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }
}
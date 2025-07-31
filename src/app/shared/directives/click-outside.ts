// src/app/shared/directives/click-outside.directive.ts
import { Directive, ElementRef, EventEmitter, Output, HostListener } from '@angular/core';

@Directive({
  selector: '[appClickOutside]'
})
export class ClickOutsideDirective {
  @Output() clickOutside = new EventEmitter<Event>();

  constructor(private elementRef: ElementRef) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (event.target && !this.elementRef.nativeElement.contains(event.target)) {
      this.clickOutside.emit(event);
    }
  }
}
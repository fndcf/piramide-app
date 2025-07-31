import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddCouple } from './add-couple';

describe('AddCouple', () => {
  let component: AddCouple;
  let fixture: ComponentFixture<AddCouple>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddCouple]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddCouple);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

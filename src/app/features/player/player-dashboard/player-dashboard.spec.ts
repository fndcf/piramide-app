import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlayerDashboard } from './player-dashboard';

describe('PlayerDashboard', () => {
  let component: PlayerDashboard;
  let fixture: ComponentFixture<PlayerDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlayerDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlayerDashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

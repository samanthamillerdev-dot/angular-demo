import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { WalletService } from '@lib/services';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './wallet.component.html'
})
export class WalletComponent implements OnInit, OnDestroy {
  walletState: any = { isConnected: false, address: null, networkName: null, isSupportedNetwork: true, error: null };
  isConnecting = false;

  private readonly walletService = inject(WalletService);
  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.walletService.walletState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.walletState = state;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  connectWallet(): void {
    this.isConnecting = true;
    this.walletService.connectWallet().subscribe({
      next: () => {
        this.isConnecting = false;
      },
      error: (error) => {
        console.error('Failed to connect wallet:', error);
        this.isConnecting = false;
      }
    });
  }

  disconnect(): void {
    this.walletService.forceDisconnect();
  }

  shortenAddress(address: string | null): string {
    return this.walletService.shortenAddress(address || '');
  }

  switchToMainnet(): void {
    this.walletService.switchNetwork(1).catch(error => {
      console.error('Failed to switch network:', error);
    });
  }
}

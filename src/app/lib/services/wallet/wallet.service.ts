import { Injectable } from '@angular/core';
import { ethers } from 'ethers';
import { BehaviorSubject, Observable, from, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  networkId: number | null;
  networkName: string | null;
  isSupportedNetwork: boolean;
  error: string | null;
}

export interface NetworkInfo {
  chainId: number;
  name: string;
  isSupported: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  private readonly _walletState$ = new BehaviorSubject<WalletState>({
    isConnected: false,
    address: null,
    networkId: null,
    networkName: null,
    isSupportedNetwork: true,
    error: null
  });

  private readonly _provider$ = new BehaviorSubject<ethers.BrowserProvider | null>(null);
  private readonly _signer$ = new BehaviorSubject<ethers.JsonRpcSigner | null>(null);
  
  private _accountsChangedListener?: (...args: any[]) => void;
  private _chainChangedListener?: (...args: any[]) => void;

  private readonly supportedNetworks: NetworkInfo[] = [
    { chainId: 1, name: 'Ethereum Mainnet', isSupported: true },
    { chainId: 5, name: 'Goerli Testnet', isSupported: true },
    { chainId: 11155111, name: 'Sepolia Testnet', isSupported: true },
    { chainId: 137, name: 'Polygon Mainnet', isSupported: true },
    { chainId: 80001, name: 'Polygon Mumbai', isSupported: true }
  ];

  constructor() {
    this.initializeWallet();
  }

  get walletState$(): Observable<WalletState> {
    return this._walletState$.asObservable();
  }

  get provider$(): Observable<ethers.BrowserProvider | null> {
    return this._provider$.asObservable();
  }

  get signer$(): Observable<ethers.JsonRpcSigner | null> {
    return this._signer$.asObservable();
  }

  get currentWalletState(): WalletState {
    return this._walletState$.getValue();
  }

  private initializeWallet(): void {
    if (typeof window !== 'undefined' && window.ethereum) {
      this.setupEventListeners();
      this.checkConnection();
    } else {
      this.updateWalletState({ error: 'MetaMask is not installed' });
    }
  }

  private setupEventListeners(): void {
    if (window.ethereum) {
      this._accountsChangedListener = (accounts: string[]) => {
        if (accounts.length === 0) {
          this.disconnect();
        } else {
          this.updateWalletState({ address: accounts[0], error: null });
        }
      };
      window.ethereum.on('accountsChanged', this._accountsChangedListener);

      this._chainChangedListener = (chainId: string) => {
        const networkId = parseInt(chainId, 16);
        this.updateNetworkInfo(networkId);
      };
      window.ethereum.on('chainChanged', this._chainChangedListener);
    }
  }

  private checkConnection(): void {
    if (typeof window !== 'undefined' && localStorage.getItem('walletDisconnected') === 'true') {
      localStorage.removeItem('walletDisconnected');
      return;
    }

    if (window.ethereum) {
      from(window.ethereum.request({ method: 'eth_accounts' }))
        .pipe(
          map((accounts: string[]) => {
            if (accounts.length > 0) {
              return accounts[0];
            }
            return null;
          }),
          switchMap((address) => {
            if (address && window.ethereum) {
              return from(window.ethereum.request({ method: 'eth_chainId' }))
                .pipe(
                  map((chainId: string) => ({ address, chainId: parseInt(chainId, 16) }))
                );
            }
            return from(Promise.resolve({ address: null, chainId: null }));
          }),
          catchError((error) => {
            console.error('Error checking connection:', error);
            return throwError(() => error);
          })
        )
        .subscribe({
          next: ({ address, chainId }) => {
            if (address && chainId !== null) {
              this.updateWalletState({
                isConnected: true,
                address,
                error: null
              });
              this.updateNetworkInfo(chainId);
              this.setupProvider();
            }
          },
          error: (error) => {
            this.updateWalletState({ error: 'Failed to check connection' });
          }
        });
    }
  }

  connectWallet(): Observable<boolean> {
    if (!window.ethereum) {
      this.updateWalletState({ error: 'MetaMask is not installed' });
      return throwError(() => new Error('MetaMask is not installed'));
    }

    return from(window.ethereum.request({ method: 'eth_requestAccounts' }))
      .pipe(
        map((accounts: string[]) => {
          if (accounts.length === 0) {
            throw new Error('No accounts found');
          }
          return accounts[0];
        }),
        switchMap((address) => {
          if (window.ethereum) {
            return from(window.ethereum.request({ method: 'eth_chainId' }))
              .pipe(
                map((chainId: string) => ({ address, chainId: parseInt(chainId, 16) }))
              );
          }
          return from(Promise.resolve({ address, chainId: null }));
        }),
        map(({ address, chainId }) => {
          this.updateWalletState({
            isConnected: true,
            address,
            error: null
          });
          if (chainId !== null) {
            this.updateNetworkInfo(chainId);
          }
          this.setupProvider();
          return true;
        }),
        catchError((error) => {
          console.error('Error connecting wallet:', error);
          this.updateWalletState({ error: 'Failed to connect wallet' });
          return throwError(() => error);
        })
      );
  }

  disconnect(): void {
    this.updateWalletState({
      isConnected: false,
      address: null,
      networkId: null,
      networkName: null,
      isSupportedNetwork: true,
      error: null
    });
    this._provider$.next(null);
    this._signer$.next(null);
    
    if (window.ethereum) {
      if (this._accountsChangedListener) {
        window.ethereum.removeListener('accountsChanged', this._accountsChangedListener);
      }
      if (this._chainChangedListener) {
        window.ethereum.removeListener('chainChanged', this._chainChangedListener);
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('walletDisconnected', 'true');
    }
  }

  private setupProvider(): void {
    if (window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      this._provider$.next(provider);
      
      provider.getSigner().then(signer => {
        this._signer$.next(signer);
      });
    }
  }

  private updateNetworkInfo(chainId: number): void {
    const network = this.supportedNetworks.find(n => n.chainId === chainId);
    const networkName = network ? network.name : `Unknown Network (${chainId})`;
    const isSupported = network ? network.isSupported : false;

    this.updateWalletState({
      networkId: chainId,
      networkName,
      isSupportedNetwork: isSupported,
      error: isSupported ? null : `Unsupported network: ${networkName}`
    });
  }

  private updateWalletState(updates: Partial<WalletState>): void {
    const currentState = this._walletState$.getValue();
    this._walletState$.next({ ...currentState, ...updates });
  }

  shortenAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  async switchNetwork(chainId: number): Promise<void> {
    if (!window.ethereum) {
      throw new Error('MetaMask is not installed');
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
    } catch (error: any) {
      if (error.code === 4902) {
        throw new Error(`Network with chain ID ${chainId} is not added to MetaMask`);
      }
      throw error;
    }
  }

  forceDisconnect(): void {
    this.disconnect();
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('walletConnected');
      sessionStorage.removeItem('walletConnected');
    }
  }
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (...args: any[]) => void) => void;
      removeListener: (event: string, callback: (...args: any[]) => void) => void;
    };
  }
}

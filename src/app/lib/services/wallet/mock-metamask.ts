export const mockMetaMask = {
  request: async (args: { method: string; params?: any[] }) => {
    console.log('Mock MetaMask request:', args);
    
    switch (args.method) {
      case 'eth_requestAccounts':
        return ['0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6'];
      
      case 'eth_accounts':
        return ['0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6'];
      
      case 'eth_chainId':
        return '0x1';
      
      case 'wallet_switchEthereumChain':
        return null;
      
      default:
        throw new Error(`Unsupported method: ${args.method}`);
    }
  },
  
  on: (event: string, callback: (...args: any[]) => void) => {
    
    if (event === 'accountsChanged') {
      setTimeout(() => {
        console.log('Mock: Simulating account change');
        callback(['0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6']);
      }, 5000);
    }
    
    if (event === 'chainChanged') {
      setTimeout(() => {
        console.log('Mock: Simulating network change');
        callback('0x5');
      }, 10000);
    }
  },
  
  removeListener: (event: string, callback: (...args: any[]) => void) => {
    console.log('Mock MetaMask event listener removed:', event);
  }
};

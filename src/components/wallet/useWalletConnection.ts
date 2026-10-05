"use client";

import { useSyncExternalStore } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSignMessage,
  useSwitchChain,
} from "wagmi";

type WalletConnectionOptions = {
  /** true면 브라우저 확장 지갑만 사용 (WalletConnect QR 대체 경로 없음) */
  injectedOnly?: boolean;
};

/** 화면 표시용 축약 주소 (0x1234…abcd) */
export function shortWalletAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Injective EVM 지갑 연결 상태와 동작을 한곳에 모은 훅.
 * 커넥터 선택, 네트워크 불일치 판단, 체인 전환 규칙은 여기서만 정한다.
 */
export function useWalletConnection(chainId: number, { injectedOnly = false }: WalletConnectionOptions = {}) {
  const hasInjectedWallet = useSyncExternalStore(
    () => () => undefined,
    () => "ethereum" in window,
    () => false,
  );
  const { address, chainId: connectedChainId, isConnected } = useAccount();
  const { connect, connectors, error: connectError, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const injectedConnector = connectors.find((candidate) => candidate.type === "injected");
  const walletConnectConnector = connectors.find((candidate) => candidate.type === "walletConnect");
  const connector = injectedOnly || hasInjectedWallet ? injectedConnector : walletConnectConnector;

  return {
    hasInjectedWallet,
    address,
    connectedChainId,
    isConnected,
    isWrongNetwork: isConnected && connectedChainId !== chainId,
    connector,
    connect: () => {
      if (connector) connect({ connector });
    },
    connectError,
    isConnecting,
    disconnect,
    signMessageAsync,
    switchToTargetChain: () => switchChain({ chainId }),
    isSwitching,
  };
}

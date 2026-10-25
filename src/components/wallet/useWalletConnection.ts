"use client";

import { useSyncExternalStore } from "react";
import {
  useConfig,
  useConnect,
  useConnection,
  useConnectors,
  useDisconnect,
  useSignMessage,
  useSwitchChain,
} from "wagmi";
import { injectiveChainName } from "@/components/wallet/injective-chain";

/** 체인 전환 실패 분류: 사용자가 거절했는지(rejected) 그 외 실패인지(failed) */
export type SwitchChainErrorKind = "rejected" | "failed";

const INJECTIVE_EVM_BLOCK_EXPLORERS: Record<number, string> = {
  1439: "https://testnet.blockscout.injective.network",
  1776: "https://blockscout.injective.network",
};

/**
 * Extensions may inject `window.ethereum` after the first render (MetaMask announces it with `ethereum#initialized`).
 * Without a subscription the button would stay on "Wallet unavailable" until something else re-rendered it.
 */
function subscribeToInjectedWallet(onChange: () => void): () => void {
  window.addEventListener("ethereum#initialized", onChange);
  return () => window.removeEventListener("ethereum#initialized", onChange);
}

/** 화면 표시용 축약 주소 (0x1234…abcd) */
export function shortWalletAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * `wallet_switchEthereumChain`이 4902(미등록 체인)로 실패하면 wagmi가 이 파라미터로
 * `wallet_addEthereumChain`을 호출해 체인을 추가한다. rpcUrls는 WalletProvider에 설정된 RPC를 그대로 쓴다.
 * RPC URL이 없으면(mock 모드) undefined: 체인 전환 자체를 요청하지 않는다 (`canSwitch === false`).
 */
export function addEthereumChainParameterFor(chainId: number, rpcUrls: readonly string[]) {
  if (rpcUrls.length === 0) return undefined;
  const blockExplorer = INJECTIVE_EVM_BLOCK_EXPLORERS[chainId];
  return {
    chainName: injectiveChainName(chainId),
    nativeCurrency: { name: "Injective", symbol: "INJ", decimals: 18 },
    rpcUrls: [...rpcUrls],
    ...(blockExplorer ? { blockExplorerUrls: [blockExplorer] } : {}),
  };
}

/** First numeric EIP-1193/JSON-RPC `code` found in the error itself or its `cause` chain (undefined when there is none). */
function firstNumericCode(error: unknown, depth: number): number | undefined {
  if (!error || typeof error !== "object" || depth > 5) return undefined;
  const { code, cause } = error as { code?: unknown; cause?: unknown };
  if (typeof code === "number") return code;
  return firstNumericCode(cause, depth + 1);
}

/**
 * 사용자가 지갑에서 거절했는가. cause 체인 어디든 viem `UserRejectedRequestError`가 있으면 거절로 본다 — wagmi는 체인을
 * 추가한 뒤의 switch 거절을 provider code 4001 없이 이 에러로만 감싸 돌려준다. 예외: 그 래퍼가 4001이 아닌 숫자 code를
 * 가진 provider 에러(예: -32603 Internal JSON-RPC error)를 감싼 경우에만 실패(failed)로 본다 — injected 커넥터는
 * `wallet_addEthereumChain` 실패를 전부 UserRejectedRequestError로 감싸기 때문이다. 코드 4001이 직접 붙은 에러도 거절이다.
 */
function isUserRejection(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== "object" || depth > 5) return false;
  const { name, code, cause } = error as { name?: unknown; code?: unknown; cause?: unknown };
  if (name === "UserRejectedRequestError") {
    const innerCode = firstNumericCode(cause, depth + 1);
    return innerCode === undefined || innerCode === 4001;
  }
  if (code === 4001) return true;
  return isUserRejection(cause, depth + 1);
}

export function switchChainErrorKind(error: unknown): SwitchChainErrorKind | null {
  if (!error) return null;
  return isUserRejection(error) ? "rejected" : "failed";
}

/**
 * Injective EVM 지갑 연결 상태와 동작을 한곳에 모은 훅.
 * 커넥터 선택, 네트워크 불일치 판단, 체인 전환 규칙은 여기서만 정한다.
 * 브라우저 확장(injected) 지갑만 지원한다 — 확장이 없으면 `connector`가 undefined (WalletConnect 경로는 wagmi 3 업그레이드에서 제거, AGENTS.md 참고).
 */
export function useWalletConnection(chainId: number) {
  const hasInjectedWallet = useSyncExternalStore(
    subscribeToInjectedWallet,
    () => "ethereum" in window,
    () => false,
  );
  const config = useConfig();
  const { address, chainId: connectedChainId, isConnected } = useConnection();
  const connectors = useConnectors();
  const connectMutation = useConnect();
  const disconnectMutation = useDisconnect();
  const signMessageMutation = useSignMessage();
  const switchChainMutation = useSwitchChain();

  const injectedConnector = connectors.find((candidate) => candidate.type === "injected");
  const connector = hasInjectedWallet ? injectedConnector : undefined;
  const targetChain = config.chains.find((chain) => chain.id === chainId);
  const rpcUrls = targetChain?.rpcUrls.default.http ?? [];
  // Without an RPC URL (mock mode) the wallet could not add the chain, so the switch is never requested; the UI shows guidance instead.
  const canSwitch = rpcUrls.length > 0;

  return {
    hasInjectedWallet,
    address,
    connectedChainId,
    isConnected,
    isWrongNetwork: isConnected && connectedChainId !== chainId,
    connector,
    connect: () => {
      if (connector) connectMutation.mutate({ connector });
    },
    connectError: connectMutation.error,
    isConnecting: connectMutation.isPending,
    disconnect: () => disconnectMutation.mutate(),
    signMessageAsync: signMessageMutation.mutateAsync,
    /** false when the configured chain has no RPC URL: `switchToTargetChain` is a no-op and the UI asks the user to switch manually. */
    canSwitch,
    switchToTargetChain: () => {
      const addEthereumChainParameter = addEthereumChainParameterFor(chainId, rpcUrls);
      if (!addEthereumChainParameter) return;
      switchChainMutation.mutate({ chainId, addEthereumChainParameter });
    },
    isSwitching: switchChainMutation.isPending,
    /** null while no switch failed; "rejected" when the user declined in the wallet, "failed" otherwise. */
    switchError: switchChainErrorKind(switchChainMutation.error),
  };
}

import { useState, useEffect, useCallback } from 'react';
import { usePublicClient } from 'wagmi';
import { CHESS_GAME_ABI } from '@/config/abis';
import { CELO_CONTRACTS } from '@/config/contracts';

export interface Game {
  id: number;
  creator: string;
  wager: number;
  chain: 'celo';
  elo: number;
}

const filterGame = (game: { white: string; wager: bigint; status: number | bigint }) =>
  game && Number(game.status) === 0 && game.white !== '0x0000000000000000000000000000000000000000';

const mapGame = (
  id: number,
  game: { white: string; wager: bigint; status: number | bigint }
) => ({
  id,
  creator: game.white,
  wager: Number(game.wager) / 1e6,
  chain: 'celo',
  elo: 1200,
});

export function useLobby() {
  const publicClient = usePublicClient();
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchGames = useCallback(
    async () => {
      if (!publicClient) return [];
      try {
        const nonce = await publicClient.readContract({
          address: CELO_CONTRACTS.game as `0x${string}`,
          abi: CHESS_GAME_ABI,
          functionName: 'gameNonce',
        }) as bigint;
        const start = Number(nonce) - 1;
        const end = Math.max(0, start - 9);
        const promises = [];
        for (let i = start; i >= end; i--) {
          promises.push(
            publicClient.readContract({
              address: CELO_CONTRACTS.game as `0x${string}`,
              abi: CHESS_GAME_ABI,
              functionName: 'getGame',
              args: [BigInt(i)],
            })
          );
        }
        const results = await Promise.all(promises);
        return results
          .map((game, index) => ({
            game,
            id: start - index,
          }))
          .filter(({ game }) => filterGame(game))
          .map(({ id, game }) => mapGame(id, game));
      } catch (err) {
        console.error('Lobby fetch error:', err);
        return [];
      }
    },
    [publicClient]
  );

  const refresh = useCallback(
    async () => {
      setIsLoading(true);
      const list = await fetchGames();
      setGames(list);
      setIsLoading(false);
    },
    [fetchGames]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch lobby on mount, then poll refresh()
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { games, isLoading, refresh };
}

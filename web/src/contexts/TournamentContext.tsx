import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, Tournament } from '../services/api';

interface TournamentContextType {
  tournaments: Tournament[];
  currentTournament: Tournament | null;
  isLoading: boolean;
  error: string | null;
  setCurrentTournament: (tournament: Tournament | null) => void;
  refreshTournaments: () => Promise<void>;
}

const TournamentContext = createContext<TournamentContextType | undefined>(undefined);

interface TournamentProviderProps {
  children: ReactNode;
}

export function TournamentProvider({ children }: TournamentProviderProps) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [currentTournament, setCurrentTournamentState] = useState<Tournament | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshTournaments = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.getTournaments();
      setTournaments(data);
      
      // If no current tournament is set, try to find the open one
      if (!currentTournament) {
        const openTournament = data.find(t => t.status === 'open');
        if (openTournament) {
          setCurrentTournamentState(openTournament);
          api.setCurrentTournament(openTournament.id);
        } else if (data.length > 0) {
          // Fall back to the most recent tournament
          const mostRecent = data.sort((a, b) => b.year - a.year || b.id - a.id)[0];
          setCurrentTournamentState(mostRecent);
          api.setCurrentTournament(mostRecent.id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tournaments');
    } finally {
      setIsLoading(false);
    }
  };

  const setCurrentTournament = (tournament: Tournament | null) => {
    setCurrentTournamentState(tournament);
    api.setCurrentTournament(tournament?.id || null);
    
    // Save to localStorage for persistence
    if (tournament) {
      localStorage.setItem('currentTournamentId', tournament.id.toString());
    } else {
      localStorage.removeItem('currentTournamentId');
    }
  };

  // Load tournaments on mount
  useEffect(() => {
    const loadTournaments = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await api.getTournaments();
        setTournaments(data);
        
        // Try to restore from localStorage first
        const savedId = localStorage.getItem('currentTournamentId');
        if (savedId) {
          const savedTournament = data.find(t => t.id === parseInt(savedId));
          if (savedTournament) {
            setCurrentTournamentState(savedTournament);
            api.setCurrentTournament(savedTournament.id);
            return;
          }
        }
        
        // Otherwise, find the open tournament
        const openTournament = data.find(t => t.status === 'open');
        if (openTournament) {
          setCurrentTournamentState(openTournament);
          api.setCurrentTournament(openTournament.id);
        } else if (data.length > 0) {
          // Fall back to the most recent tournament
          const mostRecent = data.sort((a, b) => b.year - a.year || b.id - a.id)[0];
          setCurrentTournamentState(mostRecent);
          api.setCurrentTournament(mostRecent.id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tournaments');
      } finally {
        setIsLoading(false);
      }
    };

    loadTournaments();
  }, []);

  return (
    <TournamentContext.Provider
      value={{
        tournaments,
        currentTournament,
        isLoading,
        error,
        setCurrentTournament,
        refreshTournaments,
      }}
    >
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournament() {
  const context = useContext(TournamentContext);
  if (context === undefined) {
    throw new Error('useTournament must be used within a TournamentProvider');
  }
  return context;
}


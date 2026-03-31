import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthToken } from '../hooks/useAuthToken';
import { useGolferAuth } from '../contexts/GolferAuthContext';
import { 
  ArrowLeft, 
  Save, 
  Loader2, 
  Check, 
  Users,
  Flag,
  Plus,
  Minus,
  RefreshCw,
  AlertCircle,
  LogOut
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Golfer {
  id: number;
  name: string;
}

interface Group {
  id: number;
  group_number: number;
  hole_position: string;
}

interface HoleScore {
  golfer_id: number;
  golfer_name: string;
  strokes: number | null;
  relative: number | null;
}

interface TeamScore {
  strokes: number | null;
  relative: number | null;
}

interface Hole {
  hole: number;
  par: number;
  scores: HoleScore[];
  team_score?: TeamScore | null;
}

interface TeamTotals {
  team_name: string;
  total_strokes: number;
  total_relative: number;
  holes_completed: number;
}

interface ScorecardData {
  group: Group;
  golfers: Golfer[];
  holes: Hole[];
  is_team_scoring?: boolean;
  team_totals?: TeamTotals | null;
  totals: {
    golfer_id: number;
    golfer_name: string;
    total_strokes: number;
    total_relative: number;
    holes_completed: number;
  }[];
}

interface Tournament {
  id: string | number;
  name: string;
  total_holes: number;
  total_par: number;
  hole_pars?: Record<string, number>;
  tournament_format?: 'scramble' | 'stroke' | 'stableford' | 'best_ball' | 'match' | 'captain_choice' | 'custom';
  team_size?: number;
}

export const ScorecardPage: React.FC = () => {
  const { orgSlug, tournamentSlug } = useParams<{ orgSlug: string; tournamentSlug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const groupId = searchParams.get('group');
  const tournamentIdParam = searchParams.get('tournament'); // For golfer flow
  const { getToken, isAuthenticated, authType, isGolferAuth } = useAuthToken();
  const { tournament: golferTournament } = useGolferAuth();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [scorecard, setScorecard] = useState<ScorecardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Local scores state for editing
  const [localScores, setLocalScores] = useState<Record<string, number>>({});
  const [dirtyScores, setDirtyScores] = useState<Set<string>>(new Set());
  
  // Current hole being edited (for mobile view)
  const [currentHole, setCurrentHole] = useState(1);

  // Team scoring mode for scramble format
  const isTeamScoring = tournament?.tournament_format === 'scramble';

  const fetchData = useCallback(async () => {
    if (!groupId) {
      setError('No group selected');
      setLoading(false);
      return;
    }

    try {
      const token = await getToken();
      
      let tournamentId: string | number;
      
      // Get tournament - support both admin flow (org/slug) and golfer flow (ID param)
      if (tournamentIdParam) {
        // Golfer flow - tournament ID in query param
        tournamentId = tournamentIdParam;
        // We'll get tournament details from scorecard response
      } else if (orgSlug && tournamentSlug) {
        // Admin flow - look up by org slug and tournament slug
        const tournamentRes = await fetch(
          `${import.meta.env.VITE_API_URL}/api/v1/organizations/${orgSlug}/tournaments/${tournamentSlug}`
        );
        if (!tournamentRes.ok) throw new Error('Tournament not found');
        const tournamentData = await tournamentRes.json();
        const tournament = tournamentData.tournament || tournamentData;
        setTournament(tournament);
        tournamentId = tournament.id;
      } else {
        setError('Tournament not specified');
        setLoading(false);
        return;
      }

      // Get scorecard
      const scorecardRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tournamentId}/scores/scorecard?group_id=${groupId}`,
        {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        }
      );
      if (!scorecardRes.ok) {
        const errorData = await scorecardRes.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to load scorecard');
      }
      const scorecardData = await scorecardRes.json();
      setScorecard(scorecardData);
      
      // If in golfer flow, use tournament from auth context
      if (tournamentIdParam && !tournament && golferTournament) {
        // Convert golfer tournament info to Tournament format
        setTournament({
          id: golferTournament.id,
          name: golferTournament.name,
          team_size: golferTournament.team_size,
          tournament_format: golferTournament.format as Tournament['tournament_format'],
          total_holes: golferTournament.total_holes || 18,
          total_par: golferTournament.total_par || 72,
        } as Tournament);
      }

      // Initialize local scores from fetched data
      const initialScores: Record<string, number> = {};
      scorecardData.holes.forEach((hole: Hole) => {
        // Handle team scores (scramble format)
        if (scorecardData.is_team_scoring && hole.team_score?.strokes !== null && hole.team_score?.strokes !== undefined) {
          initialScores[`team-${hole.hole}`] = hole.team_score.strokes;
        }
        // Handle individual scores
        hole.scores.forEach((score: HoleScore) => {
          if (score.strokes !== null) {
            initialScores[`${hole.hole}-${score.golfer_id}`] = score.strokes;
          }
        });
      });
      setLocalScores(initialScores);
      setDirtyScores(new Set());

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, tournamentSlug, tournamentIdParam, groupId, getToken, golferTournament]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateScore = (hole: number, golferId: number, delta: number) => {
    const key = `${hole}-${golferId}`;
    const currentValue = localScores[key] ?? 4; // Default to par 4
    const newValue = Math.max(1, Math.min(15, currentValue + delta));
    
    setLocalScores(prev => ({ ...prev, [key]: newValue }));
    setDirtyScores(prev => new Set(prev).add(key));
  };

  const setScore = (hole: number, golferId: number, value: number) => {
    const key = `${hole}-${golferId}`;
    setLocalScores(prev => ({ ...prev, [key]: value }));
    setDirtyScores(prev => new Set(prev).add(key));
  };

  // Team scoring functions (for scramble format)
  const updateTeamScore = (hole: number, delta: number) => {
    const key = `team-${hole}`;
    const currentValue = localScores[key] ?? 4; // Default to par 4
    const newValue = Math.max(1, Math.min(15, currentValue + delta));
    
    setLocalScores(prev => ({ ...prev, [key]: newValue }));
    setDirtyScores(prev => new Set(prev).add(key));
  };

  const setTeamScore = (hole: number, value: number) => {
    const key = `team-${hole}`;
    setLocalScores(prev => ({ ...prev, [key]: value }));
    setDirtyScores(prev => new Set(prev).add(key));
  };

  const saveScores = async () => {
    if (!tournament || dirtyScores.size === 0) return;

    setSaving(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      // Build batch of scores to save
      const scoresToSave = Array.from(dirtyScores).map(key => {
        if (isTeamScoring) {
          // Team scoring: key is "team-{hole}"
          const hole = parseInt(key.replace('team-', ''));
          return {
            hole,
            group_id: Number(groupId),
            strokes: localScores[key],
            score_type: 'team',
          };
        } else {
          // Individual scoring: key is "{hole}-{golferId}"
          const [hole, golferId] = key.split('-').map(Number);
          return {
            hole,
            golfer_id: golferId,
            group_id: Number(groupId),
            strokes: localScores[key],
            score_type: 'individual',
          };
        }
      });

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/tournaments/${tournament.id}/scores/batch`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ scores: scoresToSave }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save scores');
      }

      toast.success(`${scoresToSave.length} scores saved!`);
      setDirtyScores(new Set());
      fetchData(); // Refresh to get updated totals

    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save scores');
    } finally {
      setSaving(false);
    }
  };

  const getParForHole = (hole: number): number => {
    if (!tournament?.hole_pars) return 4;
    return tournament.hole_pars[hole.toString()] || 4;
  };

  const getRelativeScore = (strokes: number, par: number): string => {
    const diff = strokes - par;
    if (diff === 0) return 'E';
    return diff > 0 ? `+${diff}` : diff.toString();
  };

  const getScoreColor = (strokes: number, par: number): string => {
    const diff = strokes - par;
    if (diff <= -2) return 'bg-yellow-400 text-yellow-900'; // Eagle or better
    if (diff === -1) return 'bg-red-500 text-white'; // Birdie
    if (diff === 0) return 'bg-green-500 text-white'; // Par
    if (diff === 1) return 'bg-brand-500 text-white'; // Bogey
    if (diff === 2) return 'bg-brand-700 text-white'; // Double
    return 'bg-gray-700 text-white'; // Triple+
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (error || !scorecard || !tournament) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error || 'Failed to load scorecard'}</p>
          <Link
            to={`/${orgSlug}/admin/tournaments/${tournamentSlug}`}
            className="text-green-600 hover:text-green-700"
          >
            ← Back to Tournament
          </Link>
        </div>
      </div>
    );
  }

  const totalHoles = tournament.total_holes || 18;
  const currentHoleData = scorecard.holes.find(h => h.hole === currentHole);

  // Determine back link based on auth type
  const backLink = (isGolferAuth || !orgSlug)
    ? '/golfer/dashboard' 
    : `/${orgSlug}/admin/tournaments/${tournamentSlug}`;
  const backLabel = (isGolferAuth || !orgSlug) ? 'Dashboard' : 'Back';

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-green-700 text-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <Link
                to={backLink}
                className="inline-flex items-center gap-1 text-green-200 hover:text-white text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                {backLabel}
              </Link>
              <h1 className="text-lg font-bold">
                Group {scorecard.group.group_number}
              </h1>
              <p className="text-green-200 text-sm">
                {scorecard.golfers.map(g => g.name).join(' • ')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchData}
                className="p-2 bg-green-600 rounded-lg hover:bg-green-500"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={saveScores}
                disabled={saving || dirtyScores.size === 0}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${
                  dirtyScores.size > 0
                    ? 'bg-white text-green-700 hover:bg-green-50'
                    : 'bg-green-600 text-green-300 cursor-not-allowed'
                }`}
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                {dirtyScores.size > 0 ? `Save (${dirtyScores.size})` : 'Saved'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hole Navigation */}
      <div className="bg-white border-b border-gray-200 sticky top-[72px] z-10">
        <div className="max-w-4xl mx-auto px-4 py-2">
          <div className="flex gap-1 overflow-x-auto pb-2">
            {Array.from({ length: totalHoles }, (_, i) => i + 1).map(hole => {
              const hasScore = scorecard.is_team_scoring
                ? localScores[`team-${hole}`] !== undefined
                : scorecard.golfers.every(
                    g => localScores[`${hole}-${g.id}`] !== undefined
                  );
              const isDirty = scorecard.is_team_scoring
                ? dirtyScores.has(`team-${hole}`)
                : scorecard.golfers.some(
                    g => dirtyScores.has(`${hole}-${g.id}`)
                  );
              
              return (
                <button
                  key={hole}
                  onClick={() => setCurrentHole(hole)}
                  className={`flex-shrink-0 w-10 h-10 rounded-lg font-bold text-sm flex items-center justify-center relative ${
                    currentHole === hole
                      ? 'bg-green-600 text-white'
                      : hasScore
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {hole}
                  {isDirty && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Current Hole Scoring */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {currentHoleData && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Hole Header */}
            <div className="bg-green-700 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Flag className="w-6 h-6" />
                <div>
                  <h2 className="text-2xl font-bold">Hole {currentHole}</h2>
                  <p className="text-green-200">Par {currentHoleData.par}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentHole(Math.max(1, currentHole - 1))}
                  disabled={currentHole === 1}
                  className="p-2 bg-green-600 rounded-lg disabled:opacity-50"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setCurrentHole(Math.min(totalHoles, currentHole + 1))}
                  disabled={currentHole === totalHoles}
                  className="p-2 bg-green-600 rounded-lg disabled:opacity-50 rotate-180"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Team Score (Scramble Format) */}
            {isTeamScoring ? (
              <div className="p-4">
                {/* Team Members */}
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200">
                  <Users className="w-5 h-5 text-green-600" />
                  <div>
                    <span className="font-medium text-gray-900">Team Score</span>
                    <p className="text-sm text-gray-500">
                      {scorecard.golfers.map(g => g.name).join(' & ')}
                    </p>
                  </div>
                  {dirtyScores.has(`team-${currentHole}`) && (
                    <span className="text-xs text-orange-500 ml-auto">• unsaved</span>
                  )}
                </div>

                {/* Team Score Input */}
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => updateTeamScore(currentHole, -1)}
                    className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-200 active:bg-gray-300"
                  >
                    <Minus className="w-7 h-7" />
                  </button>
                  
                  <div 
                    className={`w-24 h-24 rounded-2xl flex flex-col items-center justify-center ${
                      localScores[`team-${currentHole}`] 
                        ? getScoreColor(localScores[`team-${currentHole}`], currentHoleData.par) 
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    <span className="text-4xl font-bold">
                      {localScores[`team-${currentHole}`] ?? '-'}
                    </span>
                    {localScores[`team-${currentHole}`] && (
                      <span className="text-sm opacity-80">
                        {getRelativeScore(localScores[`team-${currentHole}`], currentHoleData.par)}
                      </span>
                    )}
                  </div>
                  
                  <button
                    onClick={() => updateTeamScore(currentHole, 1)}
                    className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-200 active:bg-gray-300"
                  >
                    <Plus className="w-7 h-7" />
                  </button>
                </div>

                {/* Quick Score Buttons */}
                <div className="mt-4">
                  <p className="text-xs text-gray-500 text-center mb-2 uppercase tracking-wide font-medium">Quick Entry</p>
                  <div className="flex gap-2 justify-center bg-gray-50 rounded-xl p-2">
                    {[currentHoleData.par - 2, currentHoleData.par - 1, currentHoleData.par, currentHoleData.par + 1, currentHoleData.par + 2, currentHoleData.par + 3].filter(v => v > 0).map(value => (
                      <button
                        key={value}
                        onClick={() => setTeamScore(currentHole, value)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          localScores[`team-${currentHole}`] === value
                            ? getScoreColor(value, currentHoleData.par)
                            : 'bg-white text-gray-600 hover:bg-gray-200 shadow-sm'
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Individual Scores (Stroke Play) */
              <div className="divide-y divide-gray-200">
                {scorecard.golfers.map(golfer => {
                  const key = `${currentHole}-${golfer.id}`;
                  const strokes = localScores[key];
                  const par = currentHoleData.par;
                  const isDirty = dirtyScores.has(key);

                  return (
                    <div key={golfer.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Users className="w-5 h-5 text-gray-400" />
                          <span className="font-medium text-gray-900">{golfer.name}</span>
                          {isDirty && (
                            <span className="text-xs text-orange-500">• unsaved</span>
                          )}
                        </div>

                        {/* Score Input */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateScore(currentHole, golfer.id, -1)}
                            className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-200 active:bg-gray-300"
                          >
                            <Minus className="w-6 h-6" />
                          </button>
                          
                          <div 
                            className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center ${
                              strokes ? getScoreColor(strokes, par) : 'bg-gray-200 text-gray-500'
                            }`}
                          >
                            <span className="text-2xl font-bold">
                              {strokes ?? '-'}
                            </span>
                            {strokes && (
                              <span className="text-xs opacity-80">
                                {getRelativeScore(strokes, par)}
                              </span>
                            )}
                          </div>
                          
                          <button
                            onClick={() => updateScore(currentHole, golfer.id, 1)}
                            className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-200 active:bg-gray-300"
                          >
                            <Plus className="w-6 h-6" />
                          </button>
                        </div>
                      </div>

                      {/* Quick Score Buttons */}
                      <div className="mt-3">
                        <div className="flex gap-2 justify-end bg-gray-50 rounded-lg p-1.5">
                          {[par - 2, par - 1, par, par + 1, par + 2, par + 3].filter(v => v > 0).map(value => (
                            <button
                              key={value}
                              onClick={() => setScore(currentHole, golfer.id, value)}
                              className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                                strokes === value
                                  ? getScoreColor(value, par)
                                  : 'bg-white text-gray-600 hover:bg-gray-200 shadow-sm'
                              }`}
                            >
                              {value}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Totals Summary */}
        <div className="mt-6 bg-white rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Check className="w-5 h-5 text-green-600" />
            Running Totals
          </h3>
          <div className="space-y-2">
            {isTeamScoring && scorecard.team_totals ? (
              // Team totals for scramble
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-700">{scorecard.team_totals.team_name}</span>
                <div className="text-right">
                  <span className="font-bold text-gray-900">{scorecard.team_totals.total_strokes || '-'}</span>
                  <span className="text-sm text-gray-500 ml-2">
                    ({scorecard.team_totals.total_relative === 0 ? 'E' : (scorecard.team_totals.total_relative > 0 ? '+' : '') + scorecard.team_totals.total_relative})
                  </span>
                  <span className="text-xs text-gray-400 ml-2">
                    thru {scorecard.team_totals.holes_completed}
                  </span>
                </div>
              </div>
            ) : (
              // Individual totals for stroke play
              scorecard.totals.map(total => (
                <div key={total.golfer_id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-gray-700">{total.golfer_name}</span>
                  <div className="text-right">
                    <span className="font-bold text-gray-900">{total.total_strokes || '-'}</span>
                    <span className="text-sm text-gray-500 ml-2">
                      ({total.total_relative === 0 ? 'E' : (total.total_relative > 0 ? '+' : '') + total.total_relative})
                    </span>
                    <span className="text-xs text-gray-400 ml-2">
                      thru {total.holes_completed}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

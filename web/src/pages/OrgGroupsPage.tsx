import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Flag,
  Loader2,
  MapPinned,
  Plus,
  RefreshCw,
  Shuffle,
  Trash2,
  Users,
} from 'lucide-react';
import { useOrganization } from '../components/OrganizationProvider';
import { adminEventPath, adminOrgRoutes } from '../utils/adminRoutes';
import { api, type Golfer, type Group, type Tournament } from '../services/api';

const GROUP_CAPACITY = 4;

const getTeamLabel = (team: Golfer) => team.team_name || team.name;

const getRosterLabel = (team: Golfer) => {
  if (team.partner_name) {
    return `${team.name} & ${team.partner_name}`;
  }

  return team.name;
};

export const OrgGroupsPage: React.FC = () => {
  const { tournamentSlug } = useParams<{ tournamentSlug: string }>();
  const { organization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [teams, setTeams] = useState<Golfer[]>([]);
  const [newGroupCount, setNewGroupCount] = useState(4);
  const [assignmentSelections, setAssignmentSelections] = useState<Record<number, string>>({});

  const loadData = useCallback(async () => {
    if (!organization || !tournamentSlug) return;

    setLoading(true);
    setLoadError(null);

    try {
      const tournamentData = await api.getOrganizationTournament(organization.slug, tournamentSlug);
      api.setCurrentTournament(tournamentData.id);

      const [groupsData, golfersData] = await Promise.all([
        api.getGroups(tournamentData.id),
        api.getGolfers({ tournament_id: tournamentData.id, per_page: 250, registration_status: 'confirmed' }),
      ]);

      setTournament(tournamentData);
      setGroups(groupsData);
      setTeams(golfersData.golfers);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load groups';
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [organization, tournamentSlug]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const confirmedTeams = useMemo(
    () => teams.filter((team) => team.registration_status === 'confirmed'),
    [teams],
  );

  const unassignedTeams = useMemo(
    () => confirmedTeams.filter((team) => !team.group_id),
    [confirmedTeams],
  );

  const groupedGroups = useMemo(() => {
    return [...groups].sort((a, b) => {
      if (a.hole_number === null && b.hole_number !== null) return 1;
      if (a.hole_number !== null && b.hole_number === null) return -1;
      if (a.hole_number !== null && b.hole_number !== null && a.hole_number !== b.hole_number) {
        return a.hole_number - b.hole_number;
      }
      return a.group_number - b.group_number;
    });
  }, [groups]);

  const assignedTeamsCount = confirmedTeams.length - unassignedTeams.length;
  const openSlots = groupedGroups.reduce(
    (total, group) => total + Math.max(GROUP_CAPACITY - group.golfer_count, 0),
    0,
  );

  const runAction = async (key: string, fn: () => Promise<void>) => {
    setWorking(key);
    try {
      await fn();
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setWorking(null);
    }
  };

  const handleAssignTeam = async (groupId: number) => {
    const selected = assignmentSelections[groupId];
    if (!selected) {
      toast.error('Choose a team to assign');
      return;
    }

    const selectedTeam = unassignedTeams.find((team) => team.id === Number(selected));

    await runAction(`assign-${groupId}`, async () => {
      await api.addGolferToGroup(groupId, Number(selected));
      toast.success(selectedTeam ? `${getTeamLabel(selectedTeam)} assigned to group` : 'Team assigned to group');
      setAssignmentSelections((prev) => ({ ...prev, [groupId]: '' }));
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center rounded-3xl bg-white shadow-sm">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (loadError || !organization || !tournament || !tournamentSlug) {
    return (
      <div className="rounded-[28px] bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-neutral-900">Unable to load groups</h1>
        <p className="mt-2 text-sm text-neutral-600">{loadError || 'Event not found.'}</p>
        <Link
          to={adminOrgRoutes.events}
          className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to events
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <section className="rounded-[28px] bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              to={adminEventPath(tournamentSlug)}
              className="inline-flex items-center gap-2 text-sm text-neutral-500 transition hover:text-neutral-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to event workspace
            </Link>
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-brand-500">Team groups</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900">Groups & starting holes</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600 sm:text-base">
              Build the day-of group sheet here: create group slots, place confirmed teams, and set starting holes
              without bouncing back to a spreadsheet.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => void loadData()}
              disabled={working !== null}
              className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              onClick={() => runAction('auto-assign', async () => {
                const result = await api.autoAssignGolfers(tournament.id);
                toast.success(result.message);
              })}
              disabled={working !== null || unassignedTeams.length === 0}
              className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
            >
              {working === 'auto-assign' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />}
              Auto-assign unplaced teams
            </button>
            <div className="flex items-center gap-2 rounded-2xl border border-neutral-200 px-3 py-2">
              <input
                type="number"
                min={1}
                max={18}
                value={newGroupCount}
                onChange={(event) => setNewGroupCount(Number(event.target.value))}
                className="w-16 border-0 bg-transparent text-sm outline-none"
              />
              <button
                onClick={() => runAction('create-groups', async () => {
                  await api.batchCreateGroups(newGroupCount, tournament.id);
                  toast.success(`Created ${newGroupCount} new group slots`);
                })}
                disabled={working !== null}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                {working === 'create-groups' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create slots
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Confirmed teams', value: confirmedTeams.length, icon: Users },
          { label: 'Placed in groups', value: assignedTeamsCount, icon: MapPinned },
          { label: 'Still unassigned', value: unassignedTeams.length, icon: Flag },
          { label: 'Open team slots', value: openSlots, icon: Plus },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-3xl bg-white p-5 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="rounded-2xl bg-brand-50 p-3 text-brand-700">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-neutral-500">{item.label}</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900">{item.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="rounded-[28px] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-brand-600" />
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Unassigned confirmed teams</h2>
            <p className="mt-1 text-sm text-neutral-500">These teams are ready to place into a starting group.</p>
          </div>
        </div>
        {unassignedTeams.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">Every confirmed team is already assigned to a group.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {unassignedTeams.map((team) => (
              <div key={team.id} className="rounded-2xl border border-neutral-200 p-4">
                <p className="font-medium text-neutral-900">{getTeamLabel(team)}</p>
                <p className="mt-1 text-sm text-neutral-600">{getRosterLabel(team)}</p>
                <p className="mt-2 text-xs text-neutral-500">{team.email}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        {groupedGroups.length === 0 ? (
          <div className="rounded-[28px] bg-white p-10 text-center shadow-sm">
            <Users className="mx-auto h-12 w-12 text-neutral-300" />
            <h2 className="mt-4 text-lg font-semibold text-neutral-900">No groups created yet</h2>
            <p className="mt-2 text-sm text-neutral-500">
              Create empty group slots first, then assign teams and starting holes.
            </p>
          </div>
        ) : (
          groupedGroups.map((group) => {
            const groupTeams = group.golfers || [];
            const isDeleting = working === `delete-${group.id}`;
            const isAssigning = working === `assign-${group.id}`;
            const isFull = group.golfer_count >= GROUP_CAPACITY;
            const hasTeams = groupTeams.length > 0;

            return (
              <div key={group.id} className="rounded-[28px] bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-400">
                      {group.hole_position_label || 'No starting hole'}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-neutral-900">Group {group.group_number}</h3>
                    <p className="mt-1 text-sm text-neutral-500">
                      {group.golfer_count} of {GROUP_CAPACITY} team slots filled
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-sm text-neutral-500">
                      <span className="sr-only">Starting hole</span>
                      <select
                        value={group.hole_number ?? ''}
                        onChange={(event) =>
                          runAction(`hole-${group.id}`, async () => {
                            const value = event.target.value;
                            await api.setGroupHole(group.id, value ? Number(value) : null);
                            toast.success(value ? 'Starting hole updated' : 'Starting hole cleared');
                          })
                        }
                        disabled={working !== null}
                        className="rounded-2xl border border-neutral-200 px-3 py-2 text-sm text-neutral-900 disabled:opacity-50"
                      >
                        <option value="">No hole yet</option>
                        {Array.from({ length: 18 }, (_, index) => index + 1).map((hole) => (
                          <option key={hole} value={hole}>
                            Hole {hole}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      onClick={() => {
                        const confirmed = window.confirm(
                          hasTeams
                            ? `Delete Group ${group.group_number}? Its teams will be moved back to the unassigned list.`
                            : `Delete Group ${group.group_number}?`,
                        );

                        if (!confirmed) return;

                        void runAction(`delete-${group.id}`, async () => {
                          await api.deleteGroup(group.id);
                          toast.success('Group deleted');
                        });
                      }}
                      disabled={working !== null}
                      className="inline-flex items-center gap-2 rounded-2xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      Delete
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_320px]">
                  <div className="space-y-3">
                    {groupTeams.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-neutral-200 p-4 text-sm text-neutral-500">
                        No teams assigned yet.
                      </div>
                    ) : (
                      groupTeams.map((team) => (
                        <div key={team.id} className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 p-4">
                          <div>
                            <p className="font-medium text-neutral-900">{getTeamLabel(team)}</p>
                            <p className="mt-1 text-sm text-neutral-600">{getRosterLabel(team)}</p>
                            <p className="mt-2 text-xs text-neutral-500">{team.email}</p>
                          </div>
                          <button
                            onClick={() =>
                              void runAction(`remove-${group.id}-${team.id}`, async () => {
                                await api.removeGolferFromGroup(group.id, team.id);
                                toast.success('Team removed from group');
                              })
                            }
                            disabled={working !== null}
                            className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="rounded-2xl border border-neutral-200 p-4">
                    <p className="text-sm font-medium text-neutral-900">Add unassigned team</p>
                    <p className="mt-1 text-sm text-neutral-500">
                      {isFull
                        ? 'This group is full. Remove a team before adding another.'
                        : 'Choose a confirmed team that is still waiting for placement.'}
                    </p>
                    <select
                      value={assignmentSelections[group.id] || ''}
                      onChange={(event) =>
                        setAssignmentSelections((prev) => ({ ...prev, [group.id]: event.target.value }))
                      }
                      disabled={working !== null || isFull || unassignedTeams.length === 0}
                      className="mt-3 w-full rounded-2xl border border-neutral-200 px-3 py-2.5 text-sm text-neutral-900 disabled:opacity-50"
                    >
                      <option value="">Choose a team…</option>
                      {unassignedTeams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {getTeamLabel(team)}
                          {team.partner_name ? ` — ${team.partner_name}` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => void handleAssignTeam(group.id)}
                      disabled={working !== null || isFull || unassignedTeams.length === 0}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
                    >
                      {isAssigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Assign team
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
};

export default OrgGroupsPage;

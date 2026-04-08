import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Loader2, Plus, RefreshCw, Shuffle, Trash2, Users } from 'lucide-react';
import { useOrganization } from '../components/OrganizationProvider';
import { adminEventPath } from '../utils/adminRoutes';
import { api, type Golfer, type Group, type Tournament } from '../services/api';

export const OrgGroupsPage: React.FC = () => {
  const { tournamentSlug } = useParams<{ tournamentSlug: string }>();
  const { organization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [golfers, setGolfers] = useState<Golfer[]>([]);
  const [newGroupCount, setNewGroupCount] = useState(4);
  const [assignmentSelections, setAssignmentSelections] = useState<Record<number, string>>({});

  const loadData = useCallback(async () => {
    if (!organization || !tournamentSlug) return;

    setLoading(true);
    try {
      const tournamentData = await api.getOrganizationTournament(organization.slug, tournamentSlug);
      api.setCurrentTournament(tournamentData.id);

      const [groupsData, golfersData] = await Promise.all([
        api.getGroups(tournamentData.id),
        api.getGolfers({ tournament_id: tournamentData.id, per_page: 250, registration_status: 'confirmed' }),
      ]);

      setTournament(tournamentData);
      setGroups(groupsData);
      setGolfers(golfersData.golfers);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  }, [organization, tournamentSlug]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const unassignedGolfers = useMemo(
    () => golfers.filter((golfer) => golfer.registration_status === 'confirmed' && !golfer.group_id),
    [golfers],
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

  const handleAddGolfer = async (groupId: number) => {
    const selected = assignmentSelections[groupId];
    if (!selected) {
      toast.error('Choose a team to assign');
      return;
    }

    await runAction(`assign-${groupId}`, async () => {
      await api.addGolferToGroup(groupId, Number(selected));
      toast.success('Team assigned');
      setAssignmentSelections((prev) => ({ ...prev, [groupId]: '' }));
    });
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center rounded-3xl bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <section className="rounded-[28px] bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link to={adminEventPath(tournamentSlug || '')} className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900">
              <ArrowLeft className="h-4 w-4" />
              Back to event
            </Link>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900">Groups & hole assignments</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Assign registered teams to starting holes so MAW can replace the spreadsheet workflow.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => void loadData()}
              className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              onClick={() => runAction('auto-assign', async () => {
                const result = await api.autoAssignGolfers(tournament?.id);
                toast.success(result.message);
              })}
              disabled={working !== null || unassignedGolfers.length === 0}
              className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            >
              {working === 'auto-assign' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />}
              Auto-assign unassigned teams
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
                  await api.batchCreateGroups(newGroupCount, tournament?.id);
                  toast.success(`Created ${newGroupCount} group slots`);
                })}
                disabled={working !== null}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {working === 'create-groups' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add groups
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <p className="text-sm text-neutral-500">Registered teams</p>
          <p className="mt-2 text-3xl font-semibold text-neutral-900">{golfers.length}</p>
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <p className="text-sm text-neutral-500">Assigned</p>
          <p className="mt-2 text-3xl font-semibold text-neutral-900">{golfers.length - unassignedGolfers.length}</p>
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <p className="text-sm text-neutral-500">Unassigned</p>
          <p className="mt-2 text-3xl font-semibold text-neutral-900">{unassignedGolfers.length}</p>
        </div>
      </section>

      <section className="rounded-[28px] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-brand-600" />
          <h2 className="text-lg font-semibold text-neutral-900">Unassigned teams</h2>
        </div>
        {unassignedGolfers.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">All confirmed teams are assigned to a group.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {unassignedGolfers.map((golfer) => (
              <div key={golfer.id} className="rounded-2xl border border-neutral-200 p-4">
                <p className="font-medium text-neutral-900">{golfer.team_name || golfer.name}</p>
                {golfer.partner_name && <p className="mt-1 text-sm text-neutral-600">{golfer.name} & {golfer.partner_name}</p>}
                <p className="mt-1 text-xs text-neutral-500">{golfer.email}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        {groupedGroups.length === 0 ? (
          <div className="rounded-[28px] bg-white p-10 text-center text-neutral-500 shadow-sm">
            No groups created yet.
          </div>
        ) : (
          groupedGroups.map((group) => (
            <div key={group.id} className="rounded-[28px] bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-400">{group.hole_position_label || 'Unassigned hole'}</p>
                  <h3 className="mt-2 text-xl font-semibold text-neutral-900">Group {group.group_number}</h3>
                  <p className="mt-1 text-sm text-neutral-500">{group.golfer_count} / 4 slots filled</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={group.hole_number ?? ''}
                    onChange={(event) => runAction(`hole-${group.id}`, async () => {
                      await api.setGroupHole(group.id, Number(event.target.value));
                      toast.success('Starting hole updated');
                    })}
                    className="rounded-2xl border border-neutral-200 px-3 py-2 text-sm text-neutral-900"
                  >
                    <option value="">No hole</option>
                    {Array.from({ length: 18 }, (_, index) => index + 1).map((hole) => (
                      <option key={hole} value={hole}>Hole {hole}</option>
                    ))}
                  </select>

                  <button
                    onClick={() => runAction(`delete-${group.id}`, async () => {
                      await api.deleteGroup(group.id);
                      toast.success('Group deleted');
                    })}
                    disabled={working !== null}
                    className="inline-flex items-center gap-2 rounded-2xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_320px]">
                <div className="space-y-3">
                  {(group.golfers || []).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-neutral-200 p-4 text-sm text-neutral-500">
                      No teams assigned yet.
                    </div>
                  ) : (
                    (group.golfers || []).map((golfer) => (
                      <div key={golfer.id} className="flex items-center justify-between rounded-2xl border border-neutral-200 p-4">
                        <div>
                          <p className="font-medium text-neutral-900">{golfer.team_name || golfer.name}</p>
                          {golfer.partner_name && (
                            <p className="mt-1 text-sm text-neutral-600">{golfer.name} & {golfer.partner_name}</p>
                          )}
                          <p className="mt-1 text-xs text-neutral-500">{golfer.email}</p>
                        </div>
                        <button
                          onClick={() => runAction(`remove-${group.id}-${golfer.id}`, async () => {
                            await api.removeGolferFromGroup(group.id, golfer.id);
                            toast.success('Team removed from group');
                          })}
                          disabled={working !== null}
                          className="rounded-xl border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="rounded-2xl border border-neutral-200 p-4">
                  <p className="text-sm font-medium text-neutral-900">Add unassigned team</p>
                  <select
                    value={assignmentSelections[group.id] || ''}
                    onChange={(event) => setAssignmentSelections((prev) => ({ ...prev, [group.id]: event.target.value }))}
                    className="mt-3 w-full rounded-2xl border border-neutral-200 px-3 py-2.5 text-sm text-neutral-900"
                  >
                    <option value="">Choose a team…</option>
                    {unassignedGolfers.map((golfer) => (
                      <option key={golfer.id} value={golfer.id}>
                        {golfer.team_name || golfer.name}
                        {golfer.partner_name ? ` — ${golfer.partner_name}` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => void handleAddGolfer(group.id)}
                    disabled={working !== null || !unassignedGolfers.length}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    {working === `assign-${group.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Assign team
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
};

export default OrgGroupsPage;

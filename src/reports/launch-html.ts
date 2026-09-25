import type { Analysis } from '../analysis.js';
import type { LaunchReport } from '../launch.js';
import { asset, shell, USERS_SECTIONS, usersData, type JourneyView } from './html.js';

/**
 * Launch-readiness report: the Apple Terminal shell with one tab per panel.
 * The end-user tab embeds the full journey report (report.js); the rest is launch.js.
 */
export function renderLaunchReport(
  report: LaunchReport,
  analysis: Analysis | undefined,
  journeys: JourneyView[],
): string {
  const main = `
  <div data-pane="overview"><section id="lc-overview"></section></div>
  <div id="tab-users-wrap" hidden><div id="lc-users-head"></div>${analysis ? USERS_SECTIONS : ''}</div>
  <div data-pane="developers" hidden><section id="lc-developers"></section></div>
  <div data-pane="commercial" hidden><section id="lc-commercial"></section></div>
  <div data-pane="security" hidden><section id="lc-security"></section></div>
  <div data-pane="segments" hidden><section id="lc-segments"></section></div>
  <div data-pane="actions" hidden><section id="lc-actions"></section></div>`;
  return shell({
    title: `${report.name} · launch readiness`,
    main,
    data: usersData(analysis, journeys),
    launch: report,
    extraJs: [asset('launch.js').toString('utf8')],
  });
}

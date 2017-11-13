function(ellipsis) {
  const moment = require('moment-timezone');
const ActionLogs = require('action-logs')(ellipsis);
moment.tz.setDefault(ellipsis.teamInfo.timeZone);
const now = moment();
const startOfToday = now.startOf('day');

function StatsDay() {
  Object.assign(this, {
    numChannels: 0,
    numUsersAsked: 0,
    numUsersAnswered: 0,
    byChannel: {},
    standupSummaries: [],
    standupMoments: [],
    startOfDay: null,
    mostRecentStandup: null
  });
}

const yesterday = new StatsDay();
const today = new StatsDay();

ActionLogs.logsFor('Standup status summary', null, null, null, 'scheduled').then(summaries => {
  const allToday = summaries.filter((ea) => startOfToday.isBefore(ea.timestamp));
  today.byChannel = ActionLogs.groupByChannel(allToday);
  today.standupSummaries = ActionLogs.mostRecentPerGroup(today.byChannel);
  today.numChannels = today.standupSummaries.length;
  today.mostRecentStandup = moment(now);
  
  const allBeforeToday = summaries.filter((ea) => startOfToday.isAfter(ea.timestamp));
  if (allBeforeToday.length > 0) {
    yesterday.mostRecentStandup = moment.max(allBeforeToday.map((ea) => moment(ea.timestamp)));
    yesterday.startOfDay = moment(yesterday.mostRecentStandup).startOf('day');
    const yesterdayInRange = allBeforeToday.filter((ea) => yesterday.startOfDay.isBefore(ea.timestamp));
    yesterday.byChannel = ActionLogs.groupByChannel(yesterdayInRange);
    yesterday.standupSummaries = ActionLogs.mostRecentPerGroup(yesterday.byChannel);
  }
  yesterday.numChannels = yesterday.standupSummaries.length;

  const allValidSummaries = yesterday.standupSummaries.concat(today.standupSummaries);
  const allMoments = allValidSummaries.map((ea) => moment(ea.timestamp));
  const firstStandupDate = moment.min(allMoments);
  const lastStandupDate = moment.max(allMoments);
  const windowStart = moment(firstStandupDate).subtract(4, 'days');
  const windowEnd = moment(lastStandupDate);

  ActionLogs.logsFor('Check standup status', null, null, null, 'scheduled').then(allAsked => {
    ActionLogs.logsFor('Answer status questions').then(allAnswered => {
      
      const askedByChannel = ActionLogs.groupByChannel(allAsked);
      const answeredByChannel = ActionLogs.groupByChannel(allAnswered);
      processDay(yesterday, askedByChannel, answeredByChannel);
      processDay(today, askedByChannel, answeredByChannel, yesterday);      
      const yesterdayResponse = responseFor(yesterday);
      const todayResponse = responseFor(today);
      const response = responseFor(yesterday) + responseFor(today);
      ellipsis.success(response || "No standups have occurred in the past few days.");

    });
  });
});

function responseFor(day) {
  const completionRate = day.numUsersAsked > 0 ? (day.numUsersAnswered / day.numUsersAsked * 100).toFixed(1) : "0";
  let dateRange = dateRangeFor(day);
  return day.numUsersAsked > 0 ? `
  **Stats for the ${day.numChannels === 1 ? "standup" : "standups"} completed ${dateRange}:**
  - ${
    day.numUsersAsked === 1 ? "1 participant" : `${day.numUsersAsked} participants`
  } ${
    day.numChannels === 1 ? "in 1 channel" : `across ${day.numChannels} channels`
  }
  - ${
    day.numUsersAnswered === 1 ? `1 complete response` : `${day.numUsersAnswered} complete responses`
  } before the ${
    day.numChannels === 1 ? "summary was posted" : "summaries were posted"
  }
  - ${completionRate}% completion rate

` : "";
}

function dateRangeFor(day) {
  if (!day.mostRecentStandup) {
    return "";
  } else if (day.mostRecentStandup.isSame(now, 'day')) {
    return "today";
  } else {
    return `on ${day.mostRecentStandup.format("dddd, MMMM D")}`;
  }
}

function mostRecentInSummaryRange(logs, summary, previousSummary) {
  const filtered = logs.filter((ea) => {
    const when = moment(ea.timestamp);
    const wasBeforeSummary = when.isBefore(summary.timestamp);
    const wasAfterPreviousSummary = !previousSummary || when.isAfter(previousSummary.timestamp);
    return wasBeforeSummary && wasAfterPreviousSummary;
  });
  return ActionLogs.mostRecentPerUserInChannel(filtered, ActionLogs.channelForComparison(summary.channel));
}

function processDay(day, askedByChannel, answeredByChannel, previousDay) {
  day.standupSummaries.forEach((summary) => {
    const channel = ActionLogs.channelForComparison(summary.channel);
    const asked = askedByChannel[channel];
    const yesterdayInChannel = previousDay ? previousDay.standupSummaries.find((ys) => ActionLogs.channelForComparison(ys.channel) === channel) : null;
    if (asked) {
      const askedPerUser = mostRecentInSummaryRange(asked, summary, yesterdayInChannel);
      day.numUsersAsked += askedPerUser.length;
      if (askedPerUser.length > 0) {
        const answered = answeredByChannel[channel];
        if (answered) {
          const answeredPerUser = mostRecentInSummaryRange(answered, summary, yesterdayInChannel);
          const validAnswered = ActionLogs.filterAnswersAfterLastAsked(answeredPerUser, askedPerUser);
          day.numUsersAnswered += validAnswered.length;
        }
      }
    }
  });
}
}

/*
@exportId UMLHL2_sTjGrBOucKAaJAw
*/
module.exports = (function() {
const groupBy = require('group-by');
const moment = require('moment-timezone');
const getActionLogs = require('ellipsis-action-logs').get;

return function(optionalChannel, ellipsis) {
  return {
    queryWindowStart: queryWindowStartFor(ellipsis),
    questionLogs: questionLogsFn(optionalChannel, ellipsis),
    answerLogs: answerLogsFn(optionalChannel, ellipsis),
    summaryLogs: summaryLogsFn(optionalChannel, ellipsis),
    filterAnswersAfterLastAsked: filterAnswersAfterLastAskedFn(ellipsis),
    channelForComparison: channelForComparison
  };
};

function queryWindowStartFor(ellipsis) {
  return moment.tz(new Date(), ellipsis.teamInfo.timeZone).subtract(4, 'day').toDate();
}

function channelForComparison(channel) {
  return channel ? channel.trim().replace(/#/, "") : "";
}

function filteredByChannel(actionLogs, optionalChannel) {
  return actionLogs.filter(ea => {
    if (optionalChannel) {
      return ea.paramValues.channel && 
        (channelForComparison(ea.paramValues.channel) === channelForComparison(optionalChannel));
    } else {
      return true;
    }
  });
}

function logsFor(actionName, from, to, ellipsis, optionalUser) {
  return new Promise((resolve, reject) => {
    getActionLogs({
      action: actionName,
      from: from,
      to: to || new Date(),
      userId: optionalUser,
      ellipsis: ellipsis,
      success: resolve,
      error: reject
    });
  });
}

function getMostRecentByKey(grouped) {
  const userResults = [];
  Object.keys(grouped).forEach(key => {
    const mostRecent = grouped[key].sort((a, b) => a.timestamp > b.timestamp ? -1 : 1)[0];
    userResults.push(Object.assign({}, mostRecent.paramValues, {
      user: mostRecent.userIdForContext,
      timestamp: mostRecent.timestamp
    }));
  });
  return userResults;
}

function mostRecentByUserIn(arr) {
  const byUserInChannel = groupBy(arr, (ea) => `${ea.userIdForContext}-${channelForComparison(ea.paramValues.channel)}`);
  return getMostRecentByKey(byUserInChannel);
}

function byChannel(arr) {
  const groupedByChannel = groupBy(arr, (ea) => channelForComparison(ea.paramValues.channel));
  return getMostRecentByKey(groupedByChannel);
}

function logsByUserFn(actionName, optionalChannel, ellipsis, optionalStartTimestamp, optionalEndTimestamp) {
  return function(optionalUser, optionalStartTimestamp, optionalEndTimestamp) {
    const from = optionalStartTimestamp || queryWindowStartFor(ellipsis);
    return logsFor(actionName, from, optionalEndTimestamp, ellipsis, optionalUser)
      .then(logs => filteredByChannel(logs, optionalChannel))
      .then(logs => mostRecentByUserIn(logs));
  };
}

function logsByChannelFn(actionName, optionalChannel, ellipsis, optionalStartTimestamp, optionalEndTimestamp) {
  return function(optionalStartTimestamp, optionalEndTimestamp) {
    const from = optionalStartTimestamp || queryWindowStartFor(ellipsis);
    return logsFor(actionName, from, optionalEndTimestamp, ellipsis, null)
      .then(logs => byChannel(logs));
  }
}

function questionLogsFn(optionalChannel, ellipsis, optionalStartTimestamp, optionalEndTimestamp) {
  return logsByUserFn('Check standup status', optionalChannel, ellipsis, optionalStartTimestamp, optionalEndTimestamp);
}

function answerLogsFn(optionalChannel, ellipsis, optionalStartTimestamp, optionalEndTimestamp) {
  return logsByUserFn('Answer status questions', optionalChannel, ellipsis, optionalStartTimestamp, optionalEndTimestamp);
}

function summaryLogsFn(optionalChannel, ellipsis, optionalStartTimestamp, optionalEndTimestamp) {
  return logsByChannelFn('Standup status summary', optionalChannel, ellipsis, optionalStartTimestamp, optionalEndTimestamp);
}

function filterAnswersAfterLastAskedFn(ellipsis) {
  const todayStart = moment().tz(ellipsis.teamInfo.timeZone).startOf('day');
  return function(answered, askedByUser) {
    return answered.filter(ea => {
      const lastAsked = askedByUser.find(eaAsked => eaAsked.user === ea.user);
      const cutoff = lastAsked ? moment.min(moment(lastAsked.timestamp), todayStart) : todayStart;
      return moment(ea.timestamp).isAfter(cutoff);
    });
  };
}

})()
     
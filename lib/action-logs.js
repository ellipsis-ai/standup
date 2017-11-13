/*
@exportId UMLHL2_sTjGrBOucKAaJAw
*/
module.exports = (function() {
const groupBy = require('group-by');
const moment = require('moment-timezone');
const getActionLogs = require('ellipsis-action-logs').get;

return function(ellipsis) {
  const ActionLogs = {
    logsFor: function(actionName, from, to, optionalUser, optionalEventType) {
      return new Promise((resolve, reject) => {
        getActionLogs({
          action: actionName,
          from: from || this.queryWindowStart(),
          to: to || new Date(),
          userId: optionalUser,
          originalEventType: optionalEventType,
          ellipsis: ellipsis,
          success: resolve,
          error: reject
        });
      });
    },

    queryWindowStart: function() {
      return moment.tz(new Date(), ellipsis.teamInfo.timeZone).subtract(4, 'day').toDate();
    },

    channelForComparison: function(channel) {
      return channel ? channel.trim().replace(/#/, "") : "";
    },

    filterByChannel: function(actionLogs, optionalChannel) {
      return actionLogs.filter(ea => {
        if (optionalChannel) {
          return ea.paramValues.channel && 
            (ActionLogs.channelForComparison(ea.paramValues.channel) === ActionLogs.channelForComparison(optionalChannel));
        } else {
          return true;
        }
      });
    },

    groupByUserInChannel: function(logs) {
      return groupBy(logs, (ea) => `${ea.userIdForContext}-${ActionLogs.channelForComparison(ea.paramValues.channel)}`);
    },

    groupByChannel: function(logs) {
      return groupBy(logs, (ea) => ActionLogs.channelForComparison(ea.paramValues.channel));
    },

    mostRecentPerGroup: function(groupedLogs) {
      const userResults = [];
      Object.keys(groupedLogs).forEach(key => {
        const sorted = groupedLogs[key].sort((a, b) => moment(a.timestamp).isAfter(b.timestamp) ? -1 : 1);
        const mostRecent = sorted[0];
        userResults.push(Object.assign({}, mostRecent.paramValues, {
          user: mostRecent.userIdForContext,
          timestamp: mostRecent.timestamp
        }));
      });
      return userResults;
    },
    
    mostRecentPerUserInChannel: function(logs, channel) {
      return ActionLogs.mostRecentPerGroup(
        ActionLogs.groupByUserInChannel(
          ActionLogs.filterByChannel(logs, channel)
        )
      );
    },
    
    mostRecentInEachChannel: function(logs) {
      return ActionLogs.mostRecentPerGroup(
        ActionLogs.groupByChannel(logs)
      );
    },
    
    filterAnswersAfterLastAsked: function(answered, askedByUser) {
      const todayStart = moment().tz(ellipsis.teamInfo.timeZone).startOf('day');
      return answered.filter((ea) => {
        const lastAsked = askedByUser.find(eaAsked => eaAsked.user === ea.user);
        const cutoff = lastAsked ? moment.min(moment(lastAsked.timestamp), todayStart) : todayStart;
        return moment(ea.timestamp).isAfter(cutoff);
      });
    }
  };
  
  return ActionLogs;
}
})()
     
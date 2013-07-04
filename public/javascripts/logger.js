(function(Log) {
    'use strict';
    
    var DEBUG  = 4;
    var FINE   = 3;
    var MEDIUM = 2;
    var COARSE = 1;
    var OFF    = 0;

    var map = {}; // Log name to Log object.

    Log.set = function(set_string) {
        set_string.split(",").forEach(function(log_set) {
            var parts = log_set.split(":");

            // Make sure the log is in the map.
            if( ! (parts[0] in map) ) {
                map[parts[0]] = new Log.Logger(parts[0]);
            }

            // Set the level of the log.
            if( parts[1] == "debug" )       map[parts[0]].level = DEBUG;
            else if( parts[1] == "fine" )   map[parts[0]].level = FINE;
            else if( parts[1] == "medium" ) map[parts[0]].level = MEDIUM;
            else if( parts[1] == "coarse" ) map[parts[0]].level = COARSE;
            else if( parts[1] == "off" )    map[parts[0]].level = OFF;
            else console.log( "Logger: UNKNOWN LOG LEVEL " + parts[1] );
        });
    };

    Log.get = function(name) {
        if( name in map ) return map[name];
        else {
            var log = new this.Logger(name);
            map[name] = log;
            return log;
        }
    };

    Log.Logger = function(name) {
        var self = this;

        this.level = OFF;
        
        // Override this function in order to change how the logger outputs. */
        this.write = function(x) {
            console.log(x);
        };

        var println = function(x) {
            self.write( self.format(x) );
        };

        this.prefix = name + ": ";
        this.insert_prefix = "\n" + this.prefix;
        this.format = function(string) {
            return self.prefix + string.replace(/\n/g, self.insert_prefix);
        };

        this.debug = function(x) {
            if( this.level >= DEBUG ) println(x);
        };
        this.fine = function(x) {
            if( this.level >= FINE ) println(x);
        };
        this.medium = function(x) {
            if( this.level >= MEDIUM ) println(x);
        };
        this.coarse = function(x) {
            if( this.level >= COARSE ) println(x);
        };
    };

})(typeof exports === 'undefined' ? this['Log'] = {} : exports);

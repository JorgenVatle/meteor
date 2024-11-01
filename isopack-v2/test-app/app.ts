import { Meteor } from 'meteor/meteor';
import * as MeteorModule from 'meteor/meteor';
import 'meteor/webapp';
import 'meteor/ddp';

console.dir(MeteorModule, { colors: true, depth: 3, getters: 'get' });

console.log('Starting Meteor...');
Meteor.startup(() => {
    console.log('Meteor started successfully')
})
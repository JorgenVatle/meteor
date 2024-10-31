import { Meteor } from 'meteor/meteor';
import 'meteor/webapp';
import 'meteor/ddp';

console.log('Starting Meteor...');
Meteor.startup(() => {
    console.log('Meteor started successfully')
})
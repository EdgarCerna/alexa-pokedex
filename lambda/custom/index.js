const Alexa = require('ask-sdk-core');

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        const speakOutput = 'Welcome to Poke-dex. Which Pokemon would you like to know about?';
        const repromptOutput = 'Which Pokemon would you like to know about?';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .withSimpleCard('Unofficial Pokedex', speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }
};
const AboutPokemonIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AboutPokemonIntent';
    },
    async handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const intent = handlerInput.requestEnvelope.request.intent;
        const pokemonID = await intent.slots.Pokemon.resolutions.resolutionsPerAuthority[0].values[0].value.id;
        console.log('pokemonID', pokemonID);
        const results = await getPokemonData(pokemonID);
        console.log('results', results);
        
        var pokeType = '';
        for(var i=0; i < results.types.length; i++) {
          pokeType += results.types[i].type.name + '--';
        }
        console.log('pokeType', pokeType);
        
        var speciesResults = await getFromPath('/api/v2/pokemon-species/' + pokemonID);
        var pokemonVersion;
        pokemonVersion = 'Generation ' + speciesResults.generation.url.substring(37,38);

        const pokemonName = firstLetterCap(results.name);
        
        const speakOutput = pokemonName + " is a " + pokeType + " type Pokemon. " + pokemonName 
                            + " is a " + pokemonVersion + ' Pokemon. Would you like to know more about this Pokemon?';

        sessionAttributes.pokemonName = pokemonName;
        sessionAttributes.pokemonID = results.id;
        sessionAttributes.intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .withStandardCard(pokemonName, speakOutput, results.sprites.front_default, results.sprites.front_default)
            .withShouldEndSession(false)
            .getResponse();
    }
};
const EvolutionIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'EvolutionIntent';
    },
    async handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        if (sessionAttributes.intentName === 'AboutPokemonIntent') {

            var pokemonSpeciesResults = await getFromPath('/api/v2/pokemon-species/' + sessionAttributes.pokemonID);
            console.log('pokemonSpeciesResults', pokemonSpeciesResults);

            var evolutionPath = pokemonSpeciesResults.evolution_chain.url.substring(18);
            console.log('evolutionPath', evolutionPath);

            var pokemonEvolutionResults = await getFromPath(evolutionPath);
            console.log('pokemonEvolutionResults', pokemonEvolutionResults);

            // Name of first pokemon in the evolution chain with first letter uppercase
            var initialPokemon = firstLetterCap(pokemonEvolutionResults.chain.species.name);

            var speakOutput = '';
            var cardOutput = '';

            // Check if there is a first evolution available
            if (pokemonEvolutionResults.chain.evolves_to.length > 0) {
                speakOutput += '<audio src="https://pokedex-media.s3.amazonaws.com/Pokemon-Evolution-Alexa.mp3" />';
                for (var i=0; i < pokemonEvolutionResults.chain.evolves_to.length; i++) {
                    var firstEvolutionName = firstLetterCap(pokemonEvolutionResults.chain.evolves_to[i].species.name);
                    var firstEvolutionTrigger = pokemonEvolutionResults.chain.evolves_to[i].evolution_details[0].trigger.name;
                    var firstEvolutionMinLevel = pokemonEvolutionResults.chain.evolves_to[i].evolution_details[0].min_level;

                    speakOutput += initialPokemon + ' evolves into ' + firstEvolutionName + ' via ' + firstEvolutionTrigger;
                    cardOutput += initialPokemon + ' evolves into ' + firstEvolutionName + ' via ' + firstEvolutionTrigger;

                    // Add method of evolution if available
                    if (firstEvolutionTrigger === 'level-up') {
                        if (firstEvolutionMinLevel != null) {
                            // HAS MIN LEVEL
                            speakOutput += ' -- at a minimum level of ' + firstEvolutionMinLevel + '. ';
                            cardOutput += ' -- at a minimum level of ' + firstEvolutionMinLevel + '. ';
                        } else {
                            // ANY LEVEL
                            speakOutput += ' -- at any level. ';
                            cardOutput += ' -- at any level. ';
                        }
                    } else if (firstEvolutionTrigger === 'use-item') {
                        // EVOLVES BY USE ITEM
                        var firstUseItem = pokemonEvolutionResults.chain.evolves_to[i].evolution_details[0].item.name;
                        speakOutput += ' --- ' + firstUseItem + '. ';
                        cardOutput += ' --- ' + firstUseItem + '. ';
                    } else {
                        speakOutput += '. ';
                        cardOutput += '. ';
                    }

                    // Check if there is a second part to the evolution chain
                    if (pokemonEvolutionResults.chain.evolves_to[i].evolves_to.length > 0) {
                        for (var j=0; j < pokemonEvolutionResults.chain.evolves_to[i].evolves_to.length; j++) {
                            var secondEvolutionName = firstLetterCap(pokemonEvolutionResults.chain.evolves_to[i].evolves_to[j].species.name);
                            var secondEvolutionTrigger = pokemonEvolutionResults.chain.evolves_to[i].evolves_to[j].evolution_details[0].trigger.name;
                            var secondEvolutionMinLevel = pokemonEvolutionResults.chain.evolves_to[i].evolves_to[j].evolution_details[0].min_level;

                            speakOutput += firstEvolutionName + ' evolves into ' + secondEvolutionName + ' via ' + secondEvolutionTrigger;
                            cardOutput += firstEvolutionName + ' evolves into ' + secondEvolutionName + ' via ' + secondEvolutionTrigger;
                            
                            if (secondEvolutionTrigger === 'level-up') {
                                if (secondEvolutionMinLevel != null) {
                                    speakOutput += ' -- at a minimum level of ' + secondEvolutionMinLevel + '. ';
                                    cardOutput += ' -- at a minimum level of ' + secondEvolutionMinLevel + '. ';
                                } else {
                                    speakOutput += ' -- at any level. ';
                                    cardOutput += ' -- at any level. ';
                                }
                            }  else if (secondEvolutionTrigger === 'use-item') {
                                var secondUseItem = pokemonEvolutionResults.chain.evolves_to[i].evolves_to[j].evolution_details[0].item.name;
                                speakOutput += ' --- ' + secondUseItem + '. ';
                                cardOutput += ' --- ' + secondUseItem + '. ';
                            } else {
                                speakOutput += '. ';
                                cardOutput += '. ';
                            }
                        }   
                    }
                }

                speakOutput += 'Would you like to know more about ' + sessionAttributes.pokemonName + '? ';
                cardOutput += 'Would you like to know more about ' + sessionAttributes.pokemonName + '? ';
                
            } else {
                speakOutput += sessionAttributes.pokemonName + ' does not have any evolutions. Would you like to know more about '
                            + sessionAttributes.pokemonName + '? ';
                cardOutput += sessionAttributes.pokemonName + ' does not have any evolutions. Would you like to know more about '
                            + sessionAttributes.pokemonName + '? ';
            }
            
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .withStandardCard('Evolution Chain', cardOutput)
                .withShouldEndSession(false)
                .getResponse();
        } else {
            return handlerInput.responseBuilder
                .speak('You will need to ask about a Pokemon first. Which Pokemon would you like to know about?')
                .reprompt('Which Pokemon would you like to know about?')
                .withShouldEndSession(false)
                .getResponse();
        }
        
    }
};
const VariationsIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'VariationsIntent';
    },
    async handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        if (sessionAttributes.intentName === 'AboutPokemonIntent') {

            var pokemonSpeciesResults = await getFromPath('/api/v2/pokemon-species/' + sessionAttributes.pokemonID);
            console.log('pokemonSpeciesResults', pokemonSpeciesResults);

            var speakOutput = '';
            var numVariations = pokemonSpeciesResults.varieties.length - 1;
            speakOutput += sessionAttributes.pokemonName + ' has ' + numVariations + ' ';

            for (var i=1; i < pokemonSpeciesResults.varieties.length; i++) {
                if (pokemonSpeciesResults.varieties.length === 2) {
                    speakOutput += 'variation. The variation is ' + pokemonSpeciesResults.varieties[i].pokemon.name + '.';
                } else {
                    if (i === 1) {
                        speakOutput += 'variations. They are ' + pokemonSpeciesResults.varieties[i].pokemon.name;
                    } else if (i === pokemonSpeciesResults.varieties.length -1) {
                        speakOutput += '... and ' + pokemonSpeciesResults.varieties[i].pokemon.name + '.';
                    } else {
                        speakOutput += '... ' + pokemonSpeciesResults.varieties[i].pokemon.name + '.';
                    }
                }
            }
           
            speakOutput += ' Would you like to know more about ' + sessionAttributes.pokemonName + '? ';
            
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .withStandardCard(sessionAttributes.pokemonName + ' Variations', speakOutput)
                .withShouldEndSession(false)
                .getResponse();
        } else {
            return handlerInput.responseBuilder
                .speak('You will need to ask about a Pokemon first. Which Pokemon would you like to know about?')
                .reprompt('Which Pokemon would you like to know about?')
                .withShouldEndSession(false)
                .getResponse();
        }
        
    }
};


function getFromPath(path) {
    var https = require('https');

    return new Promise((resolve, reject) => {
        var options = {
        host: 'pokeapi.co',
        port: 443,
        path: path,
        method: 'GET',
        };
        
        const request = https.request(options, (response) => {
        response.setEncoding('utf8');
        let returnData = '';
        
        response.on('data', (chunk) => {
            returnData += chunk;
        });
        
        response.on('end', () => {
            resolve(JSON.parse(returnData));
        });
        
        response.on('error', (error) => {
            reject(error);
        });
        });
        request.end();
    });
}

function getPokemonData(pokemonID) {
    var https = require('https');

    return new Promise((resolve, reject) => {
        var options = {
        host: 'pokeapi.co',
        port: 443,
        path: '/api/v2/pokemon/' + pokemonID,
        method: 'GET',
        };
        
        const request = https.request(options, (response) => {
        response.setEncoding('utf8');
        let returnData = '';
        
        response.on('data', (chunk) => {
            returnData += chunk;
        });
        
        response.on('end', () => {
            resolve(JSON.parse(returnData));
        });
        
        response.on('error', (error) => {
            reject(error);
        });
        });
        request.end();
    });
}

function firstLetterCap(inString) {
    var firstChar = inString.substr(0,1).toUpperCase();
    var restOfString = inString.substr(1);
    return firstChar.concat(restOfString);
}

const YesIntentHandler = {
    canHandle(handlerInput) {
      const request = handlerInput.requestEnvelope.request;
      return request.type === 'IntentRequest'
        && request.intent.name === 'AMAZON.YesIntent';
    },
    async handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        if (sessionAttributes.intentName === 'AboutPokemonIntent') {
            return handlerInput.responseBuilder
                .speak(`Would you like to know about Evolution ... or Variations`)
                .reprompt('Ask a question.')
                .withShouldEndSession(false)
                .getResponse();
        } else {
            return handlerInput.responseBuilder
                .speak('You will need to ask about something first.')
                .reprompt('Ask a question.')
                .withShouldEndSession(false)
                .getResponse();
        }
    }
};

const NoIntentHandler = {
    canHandle(handlerInput) {
      const request = handlerInput.requestEnvelope.request;
      return request.type === 'IntentRequest'
        && request.intent.name === 'AMAZON.NoIntent';
    },
    handle(handlerInput) {
        const speechOutput = 'No problem, Goodbye!';

        return handlerInput.responseBuilder
            .speak(speechOutput)
            .withShouldEndSession(true)
            .getResponse();
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'You can say hello to me! How can I help?';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};
const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speakOutput = 'Goodbye!';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse();
    }
};

// The intent reflector is used for interaction model testing and debugging.
// It will simply repeat the intent the user said. You can create custom handlers
// for your intents by defining them above, then also adding them to the request
// handler chain below.
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = `You just triggered ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};

// Generic error handling to capture any syntax or routing errors. If you receive an error
// stating the request handler chain is not found, you have not implemented a handler for
// the intent being invoked or included it in the skill builder below.
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`~~~~ Error handled: ${error.stack}`);
        const speakOutput = `Sorry, I had trouble doing what you asked. Please try again.`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

// The SkillBuilder acts as the entry point for your skill, routing all request and response
// payloads to the handlers above. Make sure any new handlers or interceptors you've
// defined are included below. The order matters - they're processed top to bottom.
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        AboutPokemonIntentHandler,
        EvolutionIntentHandler,
        VariationsIntentHandler,
        YesIntentHandler,
        NoIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler, // make sure IntentReflectorHandler is last so it doesn't override your custom intent handlers
    )
    .addErrorHandlers(
        ErrorHandler,
    )
    .lambda();
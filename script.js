class TradingSignals {
    constructor() {
        this.fundingRates = {
            binance: {},
            bybit: {}
        };
        this.previousFundingRates = {
            binance: {},
            bybit: {}
        };
        this.markPrices = {
            binance: {},
            bybit: {}
        };
        this.signals = [];
        this.setupEventListeners();
        this.setupStyles();
    }

    // ... остальные методы остаются без изменений ...

    handleFundingRate(data) {
        const { exchange, symbol, fundingRate, timestamp } = data;

        // Сохраняем предыдущее значение перед обновлением
        if (this.fundingRates[exchange][symbol]) {
            this.previousFundingRates[exchange][symbol] = {
                ...this.fundingRates[exchange][symbol]
            };
        }

        // Обновляем текущее значение
        this.fundingRates[exchange][symbol] = {
            rate: fundingRate,
            timestamp: timestamp,
            lastUpdate: Date.now()
        };

        // Обновляем отображение funding rate
        this.updateFundingDisplay(exchange, symbol, fundingRate);

        // Генерируем сигналы только при изменении funding rate
        this.generateFundingSignals(exchange, symbol, fundingRate);

        // Анализируем арбитражные возможности
        this.analyzeArbitrage(symbol);
    }

    generateFundingSignals(exchange, symbol, currentFundingRate) {
        const previousData = this.previousFundingRates[exchange][symbol];
        const currentData = this.fundingRates[exchange][symbol];

        // Если нет предыдущего значения - выходим (первое получение данных)
        if (!previousData || !previousData.rate) {
            return;
        }

        const previousRate = previousData.rate;
        const currentRate = currentData.rate;
        const change = currentRate - previousRate;
        const changePercent = (change / Math.abs(previousRate)) * 100;

        // Минимальное изменение для генерации сигнала (0.5%)
        const minChangePercent = 0.5;

        // Если изменение меньше порога - игнорируем
        if (Math.abs(changePercent) < minChangePercent) {
            return;
        }

        const signals = [];
        const currentRatePercent = currentRate * 100;
        const changePercentFormatted = changePercent.toFixed(3);

        // Определяем направление изменения
        if (change > 0) {
            // Funding rate УВЕЛИЧИЛСЯ
            signals.push({
                type: 'FUNDING_INCREASE',
                exchange: exchange,
                symbol: symbol,
                reason: `📈 Funding rate УВЕЛИЧИЛСЯ на ${changePercentFormatted}% (с ${(previousRate * 100).toFixed(4)}% до ${currentRatePercent.toFixed(4)}%)`,
                confidence: this.getConfidenceLevel(Math.abs(changePercent)),
                timestamp: Date.now(),
                fundingRate: currentRate,
                change: change,
                changePercent: changePercent
            });

            // Дополнительные сигналы при сильном росте положительного funding
            if (currentRate > 0.001 && changePercent > 2) {
                signals.push({
                    type: 'SHORT_SIGNAL',
                    exchange: exchange,
                    symbol: symbol,
                    reason: `🚨 СИЛЬНЫЙ РОСТ положительного funding! +${changePercentFormatted}% (теперь: ${currentRatePercent.toFixed(4)}%)`,
                    confidence: 'HIGH',
                    timestamp: Date.now(),
                    fundingRate: currentRate
                });
            }
        } else {
            // Funding rate УМЕНЬШИЛСЯ
            signals.push({
                type: 'FUNDING_DECREASE',
                exchange: exchange,
                symbol: symbol,
                reason: `📉 Funding rate УМЕНЬШИЛСЯ на ${Math.abs(changePercentFormatted)}% (с ${(previousRate * 100).toFixed(4)}% до ${currentRatePercent.toFixed(4)}%)`,
                confidence: this.getConfidenceLevel(Math.abs(changePercent)),
                timestamp: Date.now(),
                fundingRate: currentRate,
                change: change,
                changePercent: changePercent
            });

            // Дополнительные сигналы при сильном снижении отрицательного funding
            if (currentRate < -0.001 && changePercent < -2) {
                signals.push({
                    type: 'LONG_SIGNAL',
                    exchange: exchange,
                    symbol: symbol,
                    reason: `🚨 СИЛЬНОЕ СНИЖЕНИЕ отрицательного funding! ${changePercentFormatted}% (теперь: ${currentRatePercent.toFixed(4)}%)`,
                    confidence: 'HIGH',
                    timestamp: Date.now(),
                    fundingRate: currentRate
                });
            }
        }

        // Сигналы при смене знака funding rate
        if (previousRate <= 0 && currentRate > 0) {
            signals.push({
                type: 'FUNDING_SIGN_CHANGE',
                exchange: exchange,
                symbol: symbol,
                reason: `🔄 Funding rate сменил знак с отрицательного на положительный: ${currentRatePercent.toFixed(4)}%`,
                confidence: 'HIGH',
                timestamp: Date.now(),
                fundingRate: currentRate
            });
        } else if (previousRate >= 0 && currentRate < 0) {
            signals.push({
                type: 'FUNDING_SIGN_CHANGE',
                exchange: exchange,
                symbol: symbol,
                reason: `🔄 Funding rate сменил знак с положительного на отрицательный: ${currentRatePercent.toFixed(4)}%`,
                confidence: 'HIGH',
                timestamp: Date.now(),
                fundingRate: currentRate
            });
        }

        // Выводим сигналы
        signals.forEach(signal => this.displaySignal(signal));

        // Логируем в консоль для отладки
        if (signals.length > 0) {
            console.log(`📊 ${exchange.toUpperCase()} ${symbol}: funding изменился на ${changePercentFormatted}%`, {
                previous: (previousRate * 100).toFixed(4) + '%',
                current: (currentRate * 100).toFixed(4) + '%',
                change: changePercent.toFixed(3) + '%'
            });
        }
    }

    // Вспомогательная функция для определения уровня уверенности
    getConfidenceLevel(changePercent) {
        if (changePercent >= 5) return 'HIGH';
        if (changePercent >= 2) return 'MEDIUM';
        return 'LOW';
    }

    // Обновленная функция analyzeArbitrage для отслеживания изменений разницы
    analyzeArbitrage(symbol) {
        const binanceFunding = this.fundingRates.binance[symbol];
        const bybitFunding = this.fundingRates.bybit[symbol];
        const binancePrevious = this.previousFundingRates.binance[symbol];
        const bybitPrevious = this.previousFundingRates.bybit[symbol];

        if (!binanceFunding || !bybitFunding || !binancePrevious || !bybitPrevious) {
            return;
        }

        const currentDiff = Math.abs(binanceFunding.rate - bybitFunding.rate);
        const previousDiff = Math.abs(binancePrevious.rate - bybitPrevious.rate);
        const diffChange = currentDiff - previousDiff;
        const diffChangePercent = (diffChange / previousDiff) * 100;

        // Сигнал при значительном изменении разницы
        if (Math.abs(diffChangePercent) > 10) { // Изменение разницы на 10%
            const direction = diffChange > 0 ? 'УВЕЛИЧИЛАСЬ' : 'УМЕНЬШИЛАСЬ';
            this.displaySignal({
                type: 'ARBITRAGE_CHANGE',
                exchange: 'both',
                symbol: symbol,
                reason: `🎯 Разница funding rate ${direction} на ${Math.abs(diffChangePercent).toFixed(1)}% (Binance: ${(binanceFunding.rate * 100).toFixed(4)}%, Bybit: ${(bybitFunding.rate * 100).toFixed(4)}%)`,
                confidence: 'MEDIUM',
                timestamp: Date.now()
            });
        }
    }

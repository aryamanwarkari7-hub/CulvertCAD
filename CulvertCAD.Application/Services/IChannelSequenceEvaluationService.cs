using CulvertCAD.Core.Entities;

namespace CulvertCAD.Application.Services;

public interface IChannelSequenceEvaluationService
{
    ChannelSequenceEvaluationModel Evaluate(
    IList<SurveyPoint> points,
    int culvertLocationIndex,
    double culvertNorthing,
    double culvertEasting,
    bool sequenceConfirmed = false);
}
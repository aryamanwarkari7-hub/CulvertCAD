// CulvertCAD.Core/Enums/Enums.cs
namespace CulvertCAD.Core.Enums;

public enum ProjectStatus      { Active, Completed, OnHold, Archived }
public enum ProjectMemberRole  { ProjectManager, DesignEngineer, CheckingEngineer, Viewer }
public enum CulvertType        { SinglePipe, MultiplePipe, Box, Arch }
public enum HydrologicalMethod { Rational, Dicken, Ryve, Inglis }
public enum LoadClass          { IRC_ClassA, IRC_ClassAA, IRC_70R, IRC_ClassB }
public enum RevisionStatus     { Draft, Submitted, UnderReview, RevisionRequired, Approved, Superseded, Void }
public enum BeddingType        { FlatBottom, ClassB, ClassC, ClassD }
public enum CommentType        { General, TechnicalQuery, Correction, Clarification }
public enum CommentStatus      { Open, Addressed, Resolved, Closed }
public enum DrawingType        { Plan, LongitudinalSection, CrossSection, DetailBedding, Composite }
public enum PipeClass          { NP1, NP2, NP3, NP4 }
public enum SurveyCodeType
{
    Centreline,
    LeftEdge,
    RightEdge,
    Tree,
    JunctionRoad,
    ExistingCulvert,
    Structure,
    Drain,
    Fence,
    TBM,
    Bridge,
    EdgePavement,
    Trench,
    ReturnWall,
    StreamBed,
    Other
}
